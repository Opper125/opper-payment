const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const port = 3000;

const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

app.post('/create-user', async (req, res) => {
    const { device_id, balance, nrc_status } = req.body;
    const { data, error } = await supabase.from('users').insert({ device_id, balance, nrc_status }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/get-user', async (req, res) => {
    const { device_id } = req.query;
    const { data, error } = await supabase.from('users').select('*').eq('device_id', device_id).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/update-profile', async (req, res) => {
    const { device_id, profile_img } = req.body;
    const { error } = await supabase.from('users').update({ profile_img }).eq('device_id', device_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/check-phone', async (req, res) => {
    const { phone } = req.query;
    const { data, error } = await supabase.from('users').select('phone, nrc_status').eq('phone', phone).single();
    if (error) return res.json(null);
    res.json(data);
});

app.get('/get-history', async (req, res) => {
    const { device_id, month } = req.query;
    const { data, error } = await supabase.from('transactions')
        .select('*')
        .or(`from_device_id.eq.${device_id},to_device_id.eq.${device_id}`)
        .gte('timestamp', new Date(new Date().setMonth(parseInt(month))).toISOString().split('T')[0]);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/submit-nrc', async (req, res) => {
    const { device_id, phone, pin, nrc_status, nrc_front, nrc_back, nrc_selfie, nrc_region, nrc_town, nrc_type, nrc_number, submitted_at } = req.body;
    const { error } = await supabase.from('users').update({
        phone, pin, nrc_status, nrc_front, nrc_back, nrc_selfie,
        nrc_region, nrc_town, nrc_type, nrc_number, submitted_at
    }).eq('device_id', device_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.post('/transfer', async (req, res) => {
    const { from_device_id, to_phone, amount, note, pin, timestamp } = req.body;

    const { data: sender, error: senderError } = await supabase.from('users').select('*').eq('device_id', from_device_id).eq('pin', pin).single();
    if (senderError || !sender) return res.status(400).json({ error: 'Sender Error or Invalid PIN' });

    const { data: receiver, error: receiverError } = await supabase.from('users').select('*').eq('phone', to_phone).single();
    if (receiverError || !receiver) return res.status(400).json({ error: 'Receiver Not Found' });

    if (sender.balance < amount) return res.status(400).json({ error: 'Insufficient Balance' });
    if (receiver.nrc_status !== 'approved') return res.status(400).json({ error: 'Receiver NRC Not Approved' });

    const { error: updateSenderError } = await supabase.from('users').update({ balance: sender.balance - amount }).eq('device_id', from_device_id);
    const { error: updateReceiverError } = await supabase.from('users').update({ balance: receiver.balance + amount }).eq('device_id', receiver.device_id);
    const { error: insertError } = await supabase.from('transactions').insert({ from_device_id, to_device_id: receiver.device_id, amount, note, timestamp });

    if (updateSenderError || updateReceiverError || insertError) {
        return res.status(500).json({ error: 'Transfer Failed' });
    }

    res.json({ new_balance: sender.balance - amount });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
