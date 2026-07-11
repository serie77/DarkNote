import { NextRequest, NextResponse } from 'next/server';

const SPLITNOW_API = 'https://splitnow.io/api';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SPLITNOW_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SplitNow API key not configured' },
        { status: 500 }
      );
    }

    const { recipientAddress, amountSol } = await request.json();

    if (!recipientAddress || !amountSol || amountSol <= 0) {
      return NextResponse.json(
        { error: 'Invalid recipient address or amount' },
        { status: 400 }
      );
    }

    // Step 1: Create a quote (SOL → SOL on Solana)
    const quoteRes = await fetch(`${SPLITNOW_API}/quotes/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        type: 'floating_rate',
        quoteInput: {
          fromAmount: amountSol,
          fromAssetId: 'sol',
          fromNetworkId: 'solana',
        },
        quoteOutputs: [
          {
            toPctBips: 10000,
            toAssetId: 'sol',
            toNetworkId: 'solana',
          },
        ],
      }),
    });

    if (!quoteRes.ok) {
      const err = await quoteRes.json().catch(() => ({ message: 'Quote creation failed' }));
      console.error('SplitNow quote error:', err);
      return NextResponse.json(
        { error: err.message || 'Failed to create quote' },
        { status: 502 }
      );
    }

    const quoteData = await quoteRes.json();
    const quoteId = quoteData.data;

    interface QuoteLeg {
      quoteLegOutput?: {
        toAmount: number;
        toExchangerId: string;
      };
    }

    // Step 1b: Poll quote details until legs are calculated (as calculations are async)
    let legs: QuoteLeg[] = [];
    let bestLeg: Required<QuoteLeg> | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const quoteDetailsRes = await fetch(`${SPLITNOW_API}/quotes/${quoteId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (quoteDetailsRes.ok) {
        const quoteDetails = await quoteDetailsRes.json();
        legs = (quoteDetails.data?.quoteLegs || []) as QuoteLeg[];
        const validLegs = legs.filter(
          (l): l is Required<QuoteLeg> =>
            !!l.quoteLegOutput && l.quoteLegOutput.toAmount > 0
        );
        if (validLegs.length > 0) {
          // Find leg with highest output amount
          bestLeg = validLegs.reduce((prev, current) => {
            return prev.quoteLegOutput.toAmount > current.quoteLegOutput.toAmount ? prev : current;
          });
          break;
        }
      }
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!bestLeg) {
      console.error('No active exchanger legs found for quote:', quoteId);
      return NextResponse.json(
        { error: 'No active exchange rates available for SOL at this moment. Please try again later.' },
        { status: 502 }
      );
    }

    const exchangerId = bestLeg.quoteLegOutput.toExchangerId;

    // Step 2: Create an order using the quote and selected exchanger
    const orderRes = await fetch(`${SPLITNOW_API}/orders/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        type: 'floating_rate',
        quoteId,
        orderInput: {
          fromAmount: amountSol,
          fromAssetId: 'sol',
          fromNetworkId: 'solana',
        },
        orderOutputs: [
          {
            toAddress: recipientAddress,
            toPctBips: 10000,
            toAssetId: 'sol',
            toNetworkId: 'solana',
            toExchangerId: exchangerId,
          },
        ],
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({ message: 'Order creation failed' }));
      console.error('SplitNow order error:', err);
      return NextResponse.json(
        { error: err.message || 'Failed to create order' },
        { status: 502 }
      );
    }

    const orderData = await orderRes.json();
    const orderId = orderData.data.orderId;

    // Step 3: Fetch order details to get the deposit wallet address (with polling in case it's still generating)
    let depositAddress: string | null = null;
    let orderDetailsError: { message?: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const orderDetailsRes = await fetch(`${SPLITNOW_API}/orders/${orderId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (orderDetailsRes.ok) {
        const orderDetails = await orderDetailsRes.json();
        depositAddress = orderDetails.data?.depositWalletAddress || null;
        if (depositAddress) {
          break;
        }
      } else {
        orderDetailsError = (await orderDetailsRes.json().catch(() => ({ message: 'Failed to fetch order details' }))) as { message?: string };
      }
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!depositAddress) {
      console.error('Deposit address missing from order details. Last error:', orderDetailsError);
      return NextResponse.json(
        { error: orderDetailsError?.message || 'SplitNow deposit address missing' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      depositAddress,
      amountSol,
    });
  } catch (error) {
    console.error('Gift API error:', error);
    return NextResponse.json(
      { error: 'Failed to process gift' },
      { status: 500 }
    );
  }
}
