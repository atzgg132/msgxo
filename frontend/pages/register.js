import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async(e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/register', {
        username,
        email,
        password
      });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      router.push('/chat');
    } catch(err) {
      console.error(err);
      alert('Registration failed');
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-200">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md">
        <h1 className="text-2xl font-bold mb-4">Register</h1>
        <div className="mb-3">
          <label className="block mb-1">Username</label>
          <input 
            className="border p-2 w-64"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required 
          />
        </div>
        <div className="mb-3">
          <label className="block mb-1">Email</label>
          <input 
            type="email"
            className="border p-2 w-64"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required 
          />
        </div>
        <div className="mb-3">
          <label className="block mb-1">Password</label>
          <input 
            type="password"
            className="border p-2 w-64"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required 
          />
        </div>
        <button 
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Register
        </button>
      </form>
    </div>
  );
}
