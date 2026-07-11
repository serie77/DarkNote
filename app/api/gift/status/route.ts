import { NextRequest, NextResponse } from 'next/server';

const SPLITNOW_API = 'https://splitnow.io/api';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SPLITNOW_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SplitNow API key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 }
      );
    }

    const res = await fetch(`${SPLITNOW_API}/orders/${orderId}`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to fetch order status' }));
      return NextResponse.json(
        { error: err.message || 'Failed to fetch order status' },
        { status: res.status }
      );
    }

    const data = await res.json();
    const order = data.data;

    // SplitNow's statusShort is the canonical 8-value enum they recommend.
    // Anything besides 'completed' that is terminal (or sub-status ending in _failed/_halted/_expired) is failure.
    const short = order.statusShort ?? order.status;
    const raw = order.status ?? '';

    let status: string;
    if (short === 'completed') {
      status = 'completed';
    } else if (
      ['expired', 'halted', 'failed', 'refunded'].includes(short) ||
      /_(?:failed|halted|expired)$/.test(raw)
    ) {
      status = 'failed';
    } else {
      status = 'processing';
    }

    return NextResponse.json({
      status,
      statusText: order.statusText ?? null,
      orderId: order._id ?? orderId,
    });
  } catch (error) {
    console.error('Gift status error:', error);
    return NextResponse.json(
      { error: 'Failed to check gift status' },
      { status: 500 }
    );
  }
}
