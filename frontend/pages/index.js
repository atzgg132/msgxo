// frontend/pages/index.js
import Link from 'next/link';

export default function Home() {
  return (
    <div className="h-screen flex flex-col justify-center items-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Our Chat App</h1>
      <div className="space-x-4">
        <Link href="/login" className="bg-blue-500 text-white px-4 py-2 rounded">
          Login
        </Link>
        <Link href="/register" className="bg-green-500 text-white px-4 py-2 rounded">
          Register
        </Link>
        <Link href="/chat" className="bg-gray-500 text-white px-4 py-2 rounded">
          Chat
        </Link>
        <Link href="/logout" className="bg-red-500 text-white px-4 py-2 rounded">
          Logout
        </Link>
      </div>
    </div>
  );
}
