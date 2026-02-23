import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import https from 'https';

export const initializePayment = async (req: Request, res: Response) => {
  try {
    const { plan_id, amount, email, callback_url } = req.body;
    const userId = (req as any).user.id;

    if (!plan_id || !amount || !email) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    // Get plan details
    const plan = await prisma.plan.findUnique({
      where: { id: plan_id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Generate unique reference
    const reference = `easyai_${userId.substring(0, 8)}_${Date.now()}`;

    // Create transaction record
    // Store amount in Naira (convert from kobo: divide by 100)
    await prisma.transaction.create({
      data: {
        user_id: userId,
        amount: amount / 100,
        currency: 'NGN',
        paystack_tx_ref: reference,
        status: 'pending',
        metadata: {
          plan_id,
          plan_name: plan.name,
          billing_cycle: plan.billing_cycle
        }
      }
    });

    // Initialize Paystack payment
    const paystackParams: any = {
      email,
      amount,
      reference,
      callback_url,
      metadata: {
        user_id: userId,
        plan_id: plan_id
      }
    };

    // Add split code or subaccount if configured for the plan
    if (plan.split_account) {
      // Paystack distinguishes between Subaccount (ACCT_...) and Split Group (SPL_...)
      if (plan.split_account.startsWith('SPL_')) {
        paystackParams.split_code = plan.split_account;
      } else {
        paystackParams.subaccount = plan.split_account;
      }
    }

    const params = JSON.stringify(paystackParams);

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      }
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';

      paystackRes.on('data', (chunk) => {
        data += chunk;
      });

      paystackRes.on('end', () => {
        if (paystackRes.statusCode === 200) {
          const responseData = JSON.parse(data);
          res.json(responseData.data);
        } else {
          console.error('Paystack initialization failed:', data);
          
          try {
            const errorData = JSON.parse(data);
            res.status(paystackRes.statusCode || 500).json({ 
              error: errorData.message || 'Payment initialization failed',
              details: errorData 
            });
          } catch (e) {
            res.status(paystackRes.statusCode || 500).json({ error: 'Payment initialization failed', details: data });
          }
        }
      });
    });

    paystackReq.on('error', (error) => {
      console.error('Paystack request error:', error);
      res.status(500).json({ error: 'Payment request failed' });
    });

    paystackReq.write(params);
    paystackReq.end();

  } catch (error) {
    console.error('Error initializing payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`
      }
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';

      paystackRes.on('data', (chunk) => {
        data += chunk;
      });

      paystackRes.on('end', async () => {
        if (paystackRes.statusCode === 200) {
          const responseData = JSON.parse(data);
          const { status, customer, metadata } = responseData.data;

          if (status === 'success') {
            // Update transaction and subscription
            await handleSuccessfulPayment(responseData.data);
            res.json({ success: true, message: 'Payment verified successfully' });
          } else {
            res.status(400).json({ success: false, message: 'Payment verification failed' });
          }
        } else {
          res.status(paystackRes.statusCode || 500).json({ error: 'Payment verification failed' });
        }
      });
    });

    paystackReq.on('error', (error) => {
      console.error('Paystack verify error:', error);
      res.status(500).json({ error: 'Payment verification failed' });
    });

    paystackReq.end();

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleSuccessfulPayment(data: any) {
  const { reference, amount, metadata, customer } = data;
  const { user_id, plan_id } = metadata || {};

  if (!user_id || !plan_id) return;

  // Update transaction status
  await prisma.transaction.update({
    where: { paystack_tx_ref: reference },
    data: {
      status: 'success',
      paystack_access_code: data.access_code || undefined, // Add to schema if needed or ignore
      payment_method: data.channel,
      updated_at: new Date()
    }
  });

  // Get plan details
  const plan = await prisma.plan.findUnique({
    where: { id: plan_id }
  });

  if (!plan) return;

  // Calculate subscription dates
  const startDate = new Date();
  let endDate = new Date();
  
  if (plan.billing_cycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (plan.billing_cycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // Update or create subscription
  // Check for existing active subscription
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      user_id,
      status: 'active'
    }
  });

  let subscriptionId;

  if (existingSubscription) {
    const updatedSub = await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        plan_id,
        status: 'active',
        start_date: startDate,
        end_date: endDate,
        updated_at: new Date()
      }
    });
    subscriptionId = updatedSub.id;
  } else {
    const newSub = await prisma.subscription.create({
      data: {
        user_id,
        plan_id,
        status: 'active',
        start_date: startDate,
        end_date: endDate,
        auto_renew: true
      }
    });
    subscriptionId = newSub.id;
  }

  // Update user with subscription_id
  if (subscriptionId) {
    await prisma.user.update({
      where: { id: user_id },
      data: { subscription_id: subscriptionId }
    });
  }
}
