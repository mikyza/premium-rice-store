import { Transaction, Payment, Order } from '../db.js';
import axios from 'axios';

export const initiatePayHeroPayment = async (req, res) => {
  try {
    const { orderId, phoneNumber, amount } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Generate a unique reference for this transaction
    const externalReference = `RICE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // PayHero API Integration Request Payload
    // Adjust endpoint and payload format according to PayHero's official documentation
    const payheroPayload = {
      amount: amount,
      phone_number: phoneNumber,
      channel_id: process.env.PAYHERO_CHANNEL_ID,
      provider: 'm-pesa',
      external_reference: externalReference,
      callback_url: 'https://premium-rice-store-7.onrender.com/api/payments/payhero/webhook'
    };

    const payheroResponse = await axios.post(
      'https://backend.payhero.co.ke/api/v2/payments', // Verify exact PayHero API URL
      payheroPayload,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.PAYHERO_API_USERNAME}:${process.env.PAYHERO_API_PASSWORD}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const responseData = payheroResponse.data;
    const checkoutRequestId = responseData.CheckoutRequestID || responseData.reference || externalReference;

    // Save initial transaction record matching your database schema
    const transaction = await Transaction.create({
      orderId: order.id,
      userId: order.userId,
      transactionRef: externalReference,
      checkoutRequestId: checkoutRequestId,
      amount: amount,
      paymentMethod: 'mpesa',
      status: 'initiated',
      rawResponse: responseData
    });

    // Save initial payment record
    await Payment.create({
      orderId: order.id,
      externalReference: externalReference,
      provider: 'm-pesa',
      amount: amount,
      phoneNumber: phoneNumber,
      status: 'PENDING',
      rawResponse: responseData
    });

    return res.status(200).json({
      success: true,
      message: 'STK push sent successfully',
      data: responseData
    });

  } catch (error) {
    console.error('PayHero Initiation Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
};
