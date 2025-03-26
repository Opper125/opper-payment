exports.handler = async (event, context) => {
  try {
    const generateId = () => Math.floor(100000 + Math.random() * 900000);

    let newId = generateId();

    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjY4NjA4MywiZXhwIjoyMDU4MjYyMDgzfQ._Jl-xGTucb9JVIENi33RqKv6SD8FyWqcwABqvU0xtzc';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    while (true) {
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', newId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!existingUser) break;
      newId = generateId();
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({ user_id: newId, balance: 0, passport_status: 'pending' });

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      body: JSON.stringify({ user_id: newId }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate ID' }),
    };
  }
};
