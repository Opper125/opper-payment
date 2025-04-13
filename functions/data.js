// Initialize Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://vtsczzlnhsrgnbkfyizi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2N6emxuaHNyZ25ia2Z5aXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2ODYwODMsImV4cCI6MjA1ODI2MjA4M30.LjP2g0WXgg6FVTM5gPIkf_qlXakkj8Hf5xzXVsx7y68';
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to fetch chat messages for a user
async function getChatMessages(userId) {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(`Fetch Chat Messages Error: ${error.message}`);
        return data;
    } catch (error) {
        console.error('Get Chat Messages Error:', error.message);
        return [];
    }
}

// Function to send a new message
async function sendMessage(userId, username, message) {
    try {
        const newMessage = {
            user_id: userId,
            username,
            message,
            status: 'open',
            created_at: new Date().toISOString()
        };
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([newMessage])
            .select()
            .single();
        if (error) throw new Error(`Send Message Error: ${error.message}`);
        return data;
    } catch (error) {
        console.error('Send Message Error:', error.message);
        throw error;
    }
}

// Function to get unread message count
async function getUnreadCount(userId) {
    try {
        const { count, error } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'open')
            .is('admin_response', null);
        if (error) throw new Error(`Get Unread Count Error: ${error.message}`);
        return count || 0;
    } catch (error) {
        console.error('Get Unread Count Error:', error.message);
        return 0;
    }
}

// Function to subscribe to real-time chat updates
function subscribeToChat(userId, callback) {
    const channel = supabase
        .channel(`chat-${userId}`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat_messages', 
                filter: `user_id=eq.${userId}` 
            }, 
            payload => {
                callback(payload.new);
            }
        )
        .on('postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'chat_messages', 
                filter: `user_id=eq.${userId}` 
            }, 
            payload => {
                callback(payload.new);
            }
        )
        .subscribe();
    return () => supabase.removeChannel(channel);
}

async function respondToChat(chatId, response) {
    try {
        const { error } = await supabase
            .from('chat_messages')
            .update({ 
                admin_response: response, 
                status: 'responded',
                updated_at: new Date().toISOString()
            })
            .eq('id', chatId);
        if (error) throw new Error(`Respond to Chat Error: ${error.message}`);
    } catch (error) {
        console.error('Respond to Chat Error:', error.message);
        throw error;
    }
}

// Export functions for use in other files
export { getChatMessages, sendMessage, getUnreadCount, subscribeToChat, respondToChat };
