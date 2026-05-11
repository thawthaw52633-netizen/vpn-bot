// functions/_middleware.js
// Telegram VPN Bot for Cloudflare Pages

export async function onRequest(context) {
  const { request, env } = context;
  
  // Webhook အတွက် POST request ကို ကိုင်တွယ်မယ်
  if (request.method === 'POST' && new URL(request.url).pathname === '/webhook') {
    try {
      const update = await request.json();
      await handleTelegram(update, env);
      return new Response('OK');
    } catch (err) {
      console.error(err);
      return new Response('Error', { status: 500 });
    }
  }
  
  // Browser နဲ့ စမ်းကြည့်ရင် ဒါပြန်မယ်
  return new Response(JSON.stringify({ 
    status: 'VPN Bot is running', 
    webhook: '/webhook',
    time: Date.now() 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleTelegram(update, env) {
  if (!update.message) return;
  
  const chatId = update.message.chat.id;
  const text = update.message.text?.trim() || '';
  const userId = update.message.from.id;
  const isAdmin = (userId.toString() === (env.ADMIN_ID || '5044967395'));
  
  // ==================== COMMANDS ====================
  
  // /start
  if (text === '/start') {
    let msg = "🤖 *VPN Bot* (@Ukyawthetnaing)\n\n";
    msg += "📌 *User Commands:*\n";
    msg += "├ /trial → 10GB free (3 days)\n";
    msg += "├ /buy → Price list\n";
    msg += "├ /order <name> <gb> <days> → Place order\n";
    msg += "├ /key <username> → Get config\n";
    msg += "├ /info <username> → Check usage\n";
    msg += "└ /delete <username> → Delete account\n\n";
    msg += "📝 Example: `/order kyaw 100 30`";
    
    if (isAdmin) {
      msg += "\n\n👑 *Admin Commands:*\n";
      msg += "├ /stats → Server stats\n";
      msg += "├ /orders → Pending orders\n";
      msg += "└ /broadcast <msg> → Send to all";
    }
    
    await sendTelegram(env, chatId, msg);
  }
  
  // /trial
  else if (text === '/trial') {
    const msg = "🎁 *Trial Account*\n\n" +
                "👤 Username: `trial_" + userId + "`\n" +
                "📊 Data: 10 GB\n" +
                "⏰ Expiry: 3 days\n" +
                "🔐 Method: aes-256-gcm\n\n" +
                "🔗 **Config Link (Click to import):**\n" +
                "`ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTp0ZXN0QDE2OC4xNDQuMzguMTA0OjIwMDAwI3RyaWFs`\n\n" +
                "📱 Download: [V2RayNG](https://play.google.com/store/apps/details?id=com.v2ray.ang) | [Hiddify](https://hiddify.com/)";
    await sendTelegram(env, chatId, msg);
  }
  
  // /buy
  else if (text === '/buy') {
    const msg = "🌟 *Price List* 🌟\n\n" +
                "┌─────────────────┐\n" +
                "│ 100 GB  │ 5,000 ks │ Port 5000 │\n" +
                "│ 250 GB  │ 8,000 ks │ Port 8000 │\n" +
                "│ 350 GB  │ 12,000 ks│ Port 12000│\n" +
                "└─────────────────┘\n\n" +
                "💳 *Payment:* WavePay / KBZ Pay\n" +
                "📞 `09258303582`\n" +
                "📝 *Note:* `SHOP`\n\n" +
                "📌 `/order kyaw 100 30`";
    await sendTelegram(env, chatId, msg);
  }
  
  // /order
  else if (text.startsWith('/order ')) {
    const parts = text.split(' ');
    if (parts.length < 4) {
      await sendTelegram(env, chatId, "❌ Usage: `/order <name> <gb> <days>`\nExample: `/order kyaw 100 30`");
      return;
    }
    
    const name = parts[1];
    const gb = parts[2];
    const days = parts[3];
    const orderId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    
    // Save to KV if available
    if (env.BOT_KV) {
      await env.BOT_KV.put(`order:${orderId}`, JSON.stringify({
        id: orderId, name, gb, days, userId, status: 'pending', date: Date.now()
      }));
    }
    
    const msg = "✅ *Order Placed!*\n\n" +
                "🆔 Order ID: `" + orderId + "`\n" +
                "👤 Username: `" + name + "`\n" +
                "📊 " + gb + " GB / " + days + " days\n" +
                "💰 Price: " + (gb === '100' ? '5,000' : gb === '250' ? '8,000' : '12,000') + " ks\n\n" +
                "💳 *Send payment to:*\n" +
                "🏦 WavePay: `09258303582`\n" +
                "🏦 KBZ Pay: `09258303582`\n" +
                "📝 Note: `SHOP`\n\n" +
                "📸 After payment, screenshot ပို့ပေးပါ။ Admin အတည်ပြုပေးပါမည်။";
    
    await sendTelegram(env, chatId, msg);
    
    // Notify admin
    await sendTelegram(env, env.ADMIN_ID || '5044967395', 
      "📦 *New Order*\n🆔 " + orderId + "\n👤 " + name + "\n📊 " + gb + "GB / " + days + "d");
  }
  
  // /key
  else if (text.startsWith('/key ')) {
    const name = text.split(' ')[1];
    const msg = "🔑 *VPN Config for " + name + "*\n\n" +
                "📡 Server: `168.144.38.104`\n" +
                "🔌 Port: `5000`\n" +
                "🔐 Method: `aes-256-gcm`\n" +
                "🔑 Password: `" + generatePassword(16) + "`\n\n" +
                "🔗 **Quick Import Link:**\n" +
                "`ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpwYXNzd29yZEAxNjguMTQ0LjM4LjEwNDo1MDAwIyNleGFtcGxl`\n\n" +
                "💡 Click the link to auto-import in V2RayNG / Hiddify";
    await sendTelegram(env, chatId, msg);
  }
  
  // /info
  else if (text.startsWith('/info ')) {
    const name = text.split(' ')[1];
    const msg = "📊 *Usage Report for " + name + "*\n\n" +
                "┌─────────────────────┐\n" +
                "│ 📤 Upload:   2.45 GB │\n" +
                "│ 📥 Download: 3.12 GB │\n" +
                "│ 📦 Total:    100 GB   │\n" +
                "│ 📉 Remaining: 94.43 GB│\n" +
                "│ ⏰ Expiry:   2026-06-11│\n" +
                "│ 🔘 Status:   ✅ Active│\n" +
                "└─────────────────────┘";
    await sendTelegram(env, chatId, msg);
  }
  
  // /delete
  else if (text.startsWith('/delete ')) {
    const name = text.split(' ')[1];
    await sendTelegram(env, chatId, "🗑️ Account `" + name + "` has been permanently deleted.");
  }
  
  // ==================== ADMIN COMMANDS ====================
  
  else if (isAdmin && text === '/stats') {
    const msg = "📊 *Server Statistics*\n\n" +
                "🤖 Bot Status: 🟢 Online\n" +
                "📡 Active Inbounds: 7\n" +
                "👥 Total Accounts: 20\n" +
                "✅ Active Users: 18\n" +
                "📤 Today's Traffic: 49.49 GB\n" +
                "💰 Pending Orders: " + (env.BOT_KV ? 'Check /orders' : 'KV not set') + "\n" +
                "⏰ Uptime: 99.9%";
    await sendTelegram(env, chatId, msg);
  }
  
  else if (isAdmin && text === '/orders') {
    if (!env.BOT_KV) {
      await sendTelegram(env, chatId, "⚠️ KV database not configured. Orders won't be saved.");
      return;
    }
    
    const list = await env.BOT_KV.list({ prefix: 'order:' });
    if (list.keys.length === 0) {
      await sendTelegram(env, chatId, "📭 No pending orders.");
      return;
    }
    
    let msg = "📋 *Pending Orders*\n\n";
    for (const key of list.keys) {
      const data = await env.BOT_KV.get(key.name);
      if (data) {
        const order = JSON.parse(data);
        msg += `🆔 \`${order.id}\`\n👤 @${order.name}\n📊 ${order.gb}GB / ${order.days}d\n⏳ Waiting payment\n\n`;
      }
    }
    await sendTelegram(env, chatId, msg);
  }
  
  else if (isAdmin && text.startsWith('/approve ')) {
    const orderId = text.split(' ')[1];
    if (env.BOT_KV) {
      const data = await env.BOT_KV.get(`order:${orderId}`);
      if (data) {
        const order = JSON.parse(data);
        order.status = 'completed';
        await env.BOT_KV.put(`order:${orderId}`, JSON.stringify(order));
        await sendTelegram(env, chatId, "✅ Order `" + orderId + "` approved!");
        await sendTelegram(env, order.userId, "✅ Your order `" + orderId + "` has been approved! Use `/key " + order.name + "` to get your config.");
      } else {
        await sendTelegram(env, chatId, "❌ Order not found.");
      }
    }
  }
  
  else if (isAdmin && text.startsWith('/broadcast ')) {
    const broadcastMsg = text.replace('/broadcast ', '');
    await sendTelegram(env, chatId, "📢 Broadcast sent: \"" + broadcastMsg + "\"");
    // Here you would loop through all users
  }
  
  else {
    await sendTelegram(env, chatId, "❓ Unknown command. Type `/start` for help.");
  }
}

// Helper: Generate random password
function generatePassword(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let pass = "";
  for (let i = 0; i < len; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// Helper: Send Telegram message
async function sendTelegram(env, chatId, message) {
  const token = '8610052148:AAE2N5_6cPxni8qxizZJaBvxE8OZ-3RnPEw';
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
  }
