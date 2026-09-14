import { Transaction, Payment, Order } from '../lib/db.js';

export const handlePayHeroWebhook = async (req, res) => {
  try {
    const callbackData = req.body;
    
    // Parse PayHero callback payload structure
    const paymentInfo = callbackData.response || callbackData;
    const checkoutRequestId = paymentInfo.CheckoutRequestID || paymentInfo.reference;
    const resultCode = paymentInfo.ResultCode; 
    const mpesaReceiptNumber = paymentInfo.MpesaReceiptNumber || paymentInfo.receipt_number;
    
    // Map status dynamically based on PayHero's response code or status fields
    let dynamicStatus = 'initiated';
    let transactionStatus = 'initiated';
    
    if (resultCode === 0 || resultCode === '0' || paymentInfo.status === 'Success') {
      dynamicStatus = 'completed';
      transactionStatus = 'completed';
    } else if (resultCode !== undefined || paymentInfo.status === 'Failed') {
      dynamicStatus = 'failed';
      transactionStatus = 'failed';
    }

    // Find the transaction using the checkout request ID / reference
    const transaction = await Transaction.findOne({ 
      where: { checkoutRequestId } 
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Update Transaction record
    await transaction.update({
      status: transactionStatus,
      rawResponse: callbackData
    });

    // Update associated Payment record if it exists
    const payment = await Payment.findOne({ where: { orderId: transaction.orderId } });
    if (payment) {
      await payment.update({
        status: dynamicStatus.toUpperCase(),
        mpesaReceiptNumber: mpesaReceiptNumber || payment.mpesaReceiptNumber,
        failureReason: paymentInfo.ResultDesc || paymentInfo.message,
        rawResponse: callbackData
      });
    }

    // Update Order status dynamically
    if (transaction.orderId) {
      const order = await Order.findByPk(transaction.orderId);
      if (order) {
        const orderStatus = dynamicStatus === 'completed' ? 'paid' : 'payment_failed';
        await order.update({ status: orderStatus });
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('PayHero Webhook Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
