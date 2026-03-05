"use client";

import Link from "next/link";

export function LandingFooter() {
    return (
        <footer className="relative bg-white pt-24 pb-12 overflow-hidden">
            <div className="max-w-7xl mx-auto px-0 sm:px-10 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-20">
                    {/* Brand Column */}
                    <div className="lg:col-span-5 space-y-8">
                        <div className="flex items-center gap-3">
                            <img src="/brand/logo.png" alt="PlacePro" className="w-6 h-6 object-contain" />
                            <span className="text-lg font-bold tracking-tight text-black uppercase">PlacePro</span>
                        </div>
                        <p className="text-neutral-500 text-[15px] max-w-sm leading-relaxed">
                            Building the global infrastructure for next-generation
                            university-to-corporate talent pipelines. Elevating outcomes
                            for elite institutions.
                        </p>
                        <div className="inline-flex items-center px-3 py-1 bg-neutral-50 border border-neutral-200 rounded-full">
                            <span className="text-[11px] font-medium text-neutral-400">placepro.in</span>
                        </div>
                    </div>

                    {/* Links Columns */}
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-12">
                        {[
                            { title: 'Explore', links: ['Features', 'Elite Dashboard', 'Smart Analytics', 'AI Resume Builder'] },
                            { title: 'Platform', links: ['Automated TPO', 'Success Stories', 'Engineering', 'Contact Sales'] },
                            { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Security Shield', 'SLA'] }
                        ].map((group) => (
                            <div key={group.title} className="space-y-6">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{group.title}</h4>
                                <ul className="space-y-4">
                                    {group.links.map((link) => (
                                        <li key={link}>
                                            <Link href="#" className="text-[14px] font-medium text-neutral-600 hover:text-blue-600 transition-colors">
                                                {link}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-10 border-t border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-[13px] text-neutral-400">
                        © 2026 PlacePro. All rights reserved.
                    </p>
                    <div className="text-[13px] text-neutral-400">
                        Design & Developed by <Link href="https://pranavgawai.in" className="text-blue-600 font-semibold hover:underline">pranavgawai</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
