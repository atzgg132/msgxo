// frontend/pages/index.js
import Link from 'next/link';

export default function Home() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-4xl font-extrabold mb-2 tracking-wide">MSGXO</h1>
      <p className="mb-8 text-gray-400">Real-Time Chat for the Modern Age</p>
      <div className="flex space-x-4">
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
        >
          Register
        </Link>
        <Link
          href="/chat"
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
        >
          Chat
        </Link>
        <Link
          href="/logout"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
        >
          Logout
        </Link>
      </div>
    </div>
  );
}
