import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get order + restaurant info
    const { data: order } = await supabase
      .from('orders')
      .select('id, total, delivery_fee, restaurants(name)')
      .eq('id', order_id)
      .maybeSingle();

    const restaurantName = (order as any)?.restaurants?.name || 'Restaurante';
    const deliveryFee = Number((order as any)?.delivery_fee) || Number((order as any)?.total) * 0.15 || 8.50;
    const feeStr = deliveryFee.toFixed(2).replace('.', ',');

    // Get push tokens of all online + active drivers
    const { data: drivers } = await supabase
      .from('drivers')
      .select('user_id')
      .eq('is_online', true)
      .eq('status', 'active');

    if (!drivers?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = drivers.map((d: any) => d.user_id);

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    if (!tokens?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send via Expo Push API (chunked, max 100 per call)
    const messages = tokens.map((t: any) => ({
      to: t.token,
      title: 'Novo pedido disponivel!',
      body: `${restaurantName} — R$ ${feeStr}`,
      sound: 'default',
      priority: 'high',
      channelId: 'pedidos',
      data: { order_id },
    }));

    // Expo allows up to 100 messages per batch
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-drivers error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
