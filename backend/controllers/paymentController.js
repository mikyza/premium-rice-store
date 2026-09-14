// controllers/paymentController.js
import { Transaction, Payment, Order } from '../db.js';
import axios from 'axios';

export const initiatePayHeroPayment = async (req, res) => {
  try {
    const { orderId, phoneNumber, amount } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Call PayHero API (adjust payload based on PayHero's actual STK Push documentation)
    const payheroPayload = {
      amount: amount,
      phone_number: phoneNumber,
      channel_id: process.env.PAYHERO_CHANNEL_ID,
      provider: 'm-pesa',
      callback_url: `${process.env.BACKEND_URL}/api/payments/payhero/webhook`,
      external_reference: `ORD-${orderId}-${Date.now()}`
    };

    const response = await axios.post('https://api.payhero.co.ke/v2/payments', payheroPayload, {
      auth: {
        username: process.env.PAYHERO_API_USERNAME,
        password: process.env.PAYHERO_API_PASSWORD
      }
    });

    const data = response.data;
    const checkoutRequestId = data.CheckoutRequestID || data.reference;

    // Create a pending transaction matching your actual database schema
    await Transaction.create({
      orderId: orderId,
      userId: order.userId,
      transactionRef: payheroPayload.external_reference,
      checkoutRequestId: checkoutRequestId,
      amount: amount,
      paymentMethod: 'mpesa',
      status: 'initiated',
      rawResponse: data
    });

    // Create or link a Payment record
    await Payment.create({
      orderId: orderId,
      externalReference: payheroPayload.external_reference,
      provider: 'm-pesa',
      amount: amount,
      phoneNumber: phoneNumber,
      status: 'PENDING',
      rawResponse: data
    });

    return res.status(200).json({
      success: true,
      message: 'STK push sent successfully',
      data
    });
  } catch (error) {
    console.error('PayHero Initiation Error:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.response?.data || error.message 
    });
  }
};
