exports.handler = async (event, context) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjY4NjA4MywiZXhwIjoyMDU4MjYyMDgzfQ._Jl-xGTucb9JVIENi33RqKv6SD8FyWqcwABqvU0xtzc';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, phone, payment_pin, passport_number, address, passport_image, selfie_image, submitted_at, balance } = JSON.parse(event.body || '{}');

    if (user_id) {
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('users')
          .insert({ 
            user_id, 
            phone: phone || null, 
            payment_pin: payment_pin || null, 
            balance: balance || 0, 
            passport_status: 'pending',
            passport_number: passport_number || null,
            address: address || null,
            passport_image: passport_image || null,
            selfie_image: selfie_image || null,
            submitted_at: submitted_at || null
          });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            phone: phone || existingUser.phone, 
            payment_pin: payment_pin || existingUser.payment_pin,
            balance: balance !== undefined ? balance : existingUser.balance,
            passport_number: passport_number || existingUser.passport_number,
            address: address || existingUser.address,
            passport_image: passport_image || existingUser.passport_image,
            selfie_image: selfie_image || existingUser.selfie_image,
            submitted_at: submitted_at || existingUser.submitted_at
          })
          .eq('user_id', user_id);
        if (updateError) throw updateError;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Data updated successfully' }),
    };
  } catch (error) {
    console.error('Data Update Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update data' }),
    };
  }
};
