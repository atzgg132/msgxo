import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
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
    } catch (err) {
      console.error(err);
      alert('Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded shadow-md w-[300px] sm:w-[350px] md:w-[400px]"
      >
        <h1 className="text-2xl font-bold mb-4 text-center">Register</h1>
        <div className="mb-3">
          <label className="block mb-1 text-gray-300">Username</label>
          <input
            className="border border-gray-700 bg-gray-700 p-2 w-full rounded outline-none focus:border-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="block mb-1 text-gray-300">Email</label>
          <input
            type="email"
            className="border border-gray-700 bg-gray-700 p-2 w-full rounded outline-none focus:border-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 text-gray-300">Password</label>
          <input
            type="password"
            className="border border-gray-700 bg-gray-700 p-2 w-full rounded outline-none focus:border-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 w-full py-2 rounded font-semibold transition-colors"
        >
          Register
        </button>
      </form>
    </div>
  );
}
