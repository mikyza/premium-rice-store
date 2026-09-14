import { Transaction, Payment, Order, sequelize } from './db.js'; // Adjust path to your model file

export const handlePayHeroWebhook = async (req, res) => {
  try {
    const callbackData = req.body;
    
    // PayHero typically returns response structures containing the reference/external reference and status
    // (Adjust these property paths based on PayHero's exact documentation schema)
    const paymentInfo = callbackData.response || callbackData;
    const checkoutRequestId = paymentInfo.CheckoutRequestID || paymentInfo.reference;
    const resultCode = paymentInfo.ResultCode; // e.g., 0 for success, non-zero for failure
    const mpesaReceiptNumber = paymentInfo.MpesaReceiptNumber || paymentInfo.receipt_number;
    
    // Map PayHero's code/status dynamically to your application states
    let dynamicStatus = 'initiated';
    let transactionStatus = 'initiated';
    
    if (resultCode === 0 || resultCode === '0' || paymentInfo.status === 'Success') {
      dynamicStatus = 'completed';
      transactionStatus = 'completed';
    } else if (resultCode !== undefined || paymentInfo.status === 'Failed') {
      dynamicStatus = 'failed';
      transactionStatus = 'failed';
    }

    // Find the transaction using the dynamic reference from PayHero
    const transaction = await Transaction.findOne({ 
      where: { checkoutRequestId } 
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Update Transaction dynamically
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

    // Update Order status dynamically based on the payment outcome
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
