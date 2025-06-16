// scripts/makeUserAdmin.js - Script to make a user admin
// Run this in your browser console or as a Node.js script

import { supabase } from '../src/config/supabase';

const makeUserAdmin = async (email) => {
  try {
    console.log('🔧 Making user admin:', email);
    
    // Update user to admin
    const { data, error } = await supabase
      .from('users')
      .update({ 
        role: 'admin', 
        is_admin: true, 
        access_level: 'unlimited' 
      })
      .eq('email', email)
      .select()
      .single();

    if (error) {
      console.error('❌ Error making user admin:', error);
      return false;
    }

    if (data) {
      console.log('✅ Successfully made user admin:', data);
      return true;
    } else {
      console.error('❌ User not found with email:', email);
      return false;
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
};

// Alternative: Direct SQL approach
const makeUserAdminSQL = async (email) => {
  try {
    console.log('🔧 Making user admin via SQL:', email);
    
    const { data, error } = await supabase.rpc('make_user_admin', {
      user_email: email
    });

    if (error) {
      console.error('❌ Error making user admin:', error);
      return false;
    }

    if (data) {
      console.log('✅ Successfully made user admin via SQL');
      return true;
    } else {
      console.error('❌ User not found with email:', email);
      return false;
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
};

// Check if user is admin
const checkIfAdmin = async (email) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email, first_name, role, is_admin, access_level')
      .eq('email', email)
      .single();

    if (error) {
      console.error('❌ Error checking user:', error);
      return;
    }

    if (data) {
      console.log('👤 User info:', data);
      const isAdmin = data.role === 'admin' || data.is_admin === true;
      console.log(isAdmin ? '✅ User is admin' : '❌ User is not admin');
      return isAdmin;
    } else {
      console.error('❌ User not found');
      return false;
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
};

// List all admin users
const listAdmins = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email, first_name, role, is_admin, access_level, created_at')
      .or('role.eq.admin,is_admin.eq.true');

    if (error) {
      console.error('❌ Error listing admins:', error);
      return;
    }

    console.log('👥 Current admin users:');
    console.table(data);
    return data;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return [];
  }
};

// Usage examples:
console.log(`
🔧 Admin Management Scripts

Usage examples:
- makeUserAdmin('your-email@example.com')
- makeUserAdminSQL('your-email@example.com') 
- checkIfAdmin('your-email@example.com')
- listAdmins()

Copy and paste these functions into your browser console on the app page.
`);

// Export for use
if (typeof window !== 'undefined') {
  // Browser environment
  window.makeUserAdmin = makeUserAdmin;
  window.makeUserAdminSQL = makeUserAdminSQL;
  window.checkIfAdmin = checkIfAdmin;
  window.listAdmins = listAdmins;
} else {
  // Node.js environment
  module.exports = {
    makeUserAdmin,
    makeUserAdminSQL,
    checkIfAdmin,
    listAdmins
  };
}