"use client";

import { motion } from "framer-motion";

export function ComparisonTable() {
    const comparisonData = [
        { f: "Student Data Updates", p: "Real-time Sync", l: "Manual Batch Uploads" },
        { f: "Resume Builder", p: "AI & Auto-Format", l: "Static PDF Upload only" },
        { f: "Company Outreach", p: "Integrated Network", l: "Email/Phone only" },
        { f: "Reporting", p: "Interactive & Granular", l: "Static Excel Dumps" }
    ];

    return (
        <motion.section
            id="comparison"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="border-b-2 border-black bg-white px-4 py-24 sm:px-8 sm:py-32"
        >
            <div className="mx-auto max-w-[1000px]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-12 text-center sm:mb-16"
                >
                    <h2 className="mb-4 font-serif text-3xl text-black md:text-4xl lg:text-5xl">
                        Why <span className="italic">PlacePro?</span>
                    </h2>
                    <p className="text-gray-600 text-sm font-light uppercase tracking-widest">
                        A superior standard for academic operations.
                    </p>
                </motion.div>

                <div className="space-y-4 md:hidden">
                    {comparisonData.map((row, i) => (
                        <div key={i} className="rounded-[24px] border-2 border-black bg-white p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-400">Feature</p>
                            <p className="mt-2 text-lg font-bold text-black">{row.f}</p>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">PlacePro</p>
                                    <p className="mt-1 text-sm font-semibold text-black">{row.p}</p>
                                </div>
                                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">Legacy ERPs</p>
                                    <p className="mt-1 text-sm text-neutral-700">{row.l}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="hidden overflow-x-auto border-2 border-black md:block"
                >
                    <table className="min-w-[640px] w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black text-white">
                                <th className="py-6 px-4 sm:px-6 w-1/3 border-r border-gray-700">
                                    <span className="text-xs font-bold uppercase tracking-wider">Features</span>
                                </th>
                                <th className="py-6 px-4 sm:px-6 w-1/3 bg-blue-600">
                                    <span className="font-bold text-white uppercase tracking-tight italic">PlacePro</span>
                                </th>
                                <th className="py-6 px-4 sm:px-6 w-1/3">
                                    <span className="font-bold text-gray-400 uppercase tracking-tight">Legacy ERPs</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium">
                            {comparisonData.map((row, i) => (
                                <tr key={i} className="border-b border-black last:border-0 hover:bg-neutral-50 transition-colors">
                                    <td className="py-5 px-4 sm:px-6 border-r border-black font-bold text-black">{row.f}</td>
                                    <td className="py-5 px-4 sm:px-6 border-r border-black bg-blue-50 font-bold text-black flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
                                        {row.p}
                                    </td>
                                    <td className="py-5 px-4 sm:px-6 text-gray-500 font-normal">{row.l}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            </div>
        </motion.section>
    );
}
