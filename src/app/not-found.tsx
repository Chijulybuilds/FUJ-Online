import Link from "next/link";
export default function NotFound(){return <main className="flex min-h-screen flex-col items-center justify-center"><p className="text-5xl font-bold text-blue-600">404</p><h1 className="mt-3 text-xl font-bold">Page not found</h1><Link href="/" className="btn btn-primary mt-5">Return home</Link></main>}
