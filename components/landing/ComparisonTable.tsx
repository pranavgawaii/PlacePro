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
            className="py-32 px-0 sm:px-8 bg-white border-b-2 border-black"
        >
            <div className="max-w-[1000px] mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-black mb-4">
                        Why <span className="italic">PlacePro?</span>
                    </h2>
                    <p className="text-gray-600 text-sm font-light uppercase tracking-widest">
                        A superior standard for academic operations.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="overflow-x-auto border-2 border-black"
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
