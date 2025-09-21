import React, { useEffect, useState } from 'react';
import { User } from '@/api/entities.jsx';

export default function UserStatus() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        console.log('Current logged in user:', user);
      } catch (err) {
        console.log('No user logged in:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, []);

  if (loading) return <div>Checking user status...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">User Status</h1>
      
      {currentUser ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="font-semibold text-green-800">✅ Logged in successfully!</h2>
          <div className="mt-2 text-sm">
            <p><strong>Name:</strong> {currentUser.full_name}</p>
            <p><strong>Email:</strong> {currentUser.email}</p>
            <p><strong>User Type:</strong> {currentUser.user_type}</p>
            <p><strong>Role:</strong> {currentUser.role}</p>
            <p><strong>ID:</strong> {currentUser.id}</p>
          </div>
          
          {currentUser.role === 'admin' ? (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800 font-medium">🎉 You have admin access!</p>
              <p className="text-blue-600 text-sm">You can access the admin dashboard.</p>
            </div>
          ) : (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 font-medium">⚠️ Admin access required</p>
              <p className="text-yellow-600 text-sm">
                Your role is "{currentUser.role}" but you need "admin" role to access the admin dashboard.
                <br />
                Update your role in database: profiles table → your record → set role = "admin"
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-red-800">❌ Not logged in</h2>
          <p className="text-red-600 text-sm mt-1">Error: {error}</p>
          <div className="mt-3">
            <p className="text-red-600 text-sm">
              Please log in first:
            </p>
            <ul className="list-disc list-inside text-red-600 text-sm mt-1">
              <li>Go to <a href="/" className="underline">home page</a></li>
              <li>Click "Login" or "Email Login"</li>
              <li>Sign in with your account</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
