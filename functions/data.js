const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
    const { action, name, nrc, phone, pin, fromPhone, toPhone, amount } = JSON.parse(event.body);

    switch (action) {
        case 'signup':
            const { data: existingUser } = await supabase.from('users').select('*').eq('phone', phone).single();
            if (existingUser) return { statusCode: 400, body: JSON.stringify({ success: false, message: 'ဖုန်းနံပါတ်ရှိပြီးသားပါ။' }) };
            await supabase.from('users').insert({ name, nrc, phone, pin, balance: 0, daily_limit: 10000000 });
            return { statusCode: 200, body: JSON.stringify({ success: true }) };

        case 'login':
            const { data: user } = await supabase.from('users').select('*').eq('phone', phone).eq('pin', pin).single();
            if (user) return { statusCode: 200, body: JSON.stringify({ success: true, balance: user.balance, user }) };
            return { statusCode: 401, body: JSON.stringify({ success: false, message: 'ဖုန်း သို့မဟုတ် PIN မမှန်ပါ။' }) };

        case 'transfer':
            const { data: sender } = await supabase.from('users').select('*').eq('phone', fromPhone).eq('pin', pin).single();
            const { data: receiver } = await supabase.from('users').select('*').eq('phone', toPhone).single();
            if (!sender || !receiver || sender.balance < amount || amount > 1000000) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: 'လွှဲမှု မဖြစ်နိုင်ပါ' }) };
            }
            const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' });
            await supabase.from('users').update({ balance: sender.balance - amount }).eq('phone', fromPhone);
            await supabase.from('users').update({ balance: receiver.balance + amount }).eq('phone', toPhone);
            await supabase.from('transactions').insert({ from_phone: fromPhone, to_phone: toPhone, amount, timestamp: now, name: receiver.name });
            return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: sender.balance - amount }) };

        default:
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'မမှန်ကန်သော လုပ်ဆောင်ချက်' }) };
    }
};
