"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function InstitutionalArchitecture() {
    const [placedCount, setPlacedCount] = useState(87);
    const [avgCtc, setAvgCtc] = useState(9.2);

    useEffect(() => {
        const interval = setInterval(() => {
            setPlacedCount(prev => prev >= 95 ? 80 : prev + 1);
        }, 150);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setAvgCtc(prev => {
                const next = parseFloat((prev + 0.1).toFixed(1));
                return next >= 12.0 ? 8.0 : next;
            });
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div className="block md:hidden w-full max-w-[720px] mx-auto mt-6">
                <div className="rounded-2xl border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.12)]">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Placement Engine</div>
                    <h3 className="mt-2 text-lg font-bold text-neutral-900">How PlacePro orchestrates outcomes</h3>
                    <p className="mt-2 text-sm text-neutral-600">
                        Student profiles, resume intelligence, and eligibility scoring sync into one placement pipeline.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                        {[
                            "Student Records",
                            "Resume Data",
                            "Academic History",
                            "Internships",
                            "Skill Matrix"
                        ].map((item) => (
                            <div key={item} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700">
                                {item}
                                <span className="text-xs text-blue-600">Sync</span>
                            </div>
                        ))}
                        <div className="rounded-lg border border-black bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900">
                            Output: {placedCount}% Placed • Avg {avgCtc} LPA
                        </div>
                    </div>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.5 }}
                className="relative w-full max-w-[1200px] h-[440px] hidden md:block mx-auto -mt-4 lg:-mt-8 origin-top scale-[0.85] lg:scale-[0.9]"
            >
                {/* Connection Lines */}
                <div className="relative w-[1000px] h-full mx-auto">
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-0"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <marker id="dot-start" markerWidth="8" markerHeight="8" refX="4" refY="4">
                            <circle cx="4" cy="4" r="2" fill="black" />
                        </marker>
                        <marker id="dot-end" markerWidth="8" markerHeight="8" refX="4" refY="4">
                            <circle cx="4" cy="4" r="2" fill="black" />
                        </marker>
                    </defs>

                    {/* Permanent Gray Skeleton Lines */}
                    {[
                        "M 230 70 L 320 70 L 400 250", "M 230 160 L 300 160 L 400 250",
                        "M 230 250 L 400 250", "M 230 340 L 300 340 L 400 250",
                        "M 230 430 L 320 430 L 400 250", "M 500 250 L 550 250",
                        "M 710 160 L 820 250", "M 710 250 L 820 250",
                        "M 710 340 L 820 250", "M 820 250 L 850 250"
                    ].map((d, i) => (
                        <motion.path
                            key={`gray-${i}`}
                            d={d}
                            fill="none"
                            stroke="#d4d4d4"
                            strokeWidth="1.5"
                            initial={{ pathLength: 0, opacity: 0 }}
                            whileInView={{ pathLength: 1, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 1.2 + i * 0.02, ease: "easeInOut" }}
                        />
                    ))}

                    {/* Premium Blue Data Flow (Pulsing Signals) */}
                    {[
                        "M 230 70 L 320 70 L 400 250", "M 230 160 L 300 160 L 400 250",
                        "M 230 250 L 400 250", "M 230 340 L 300 340 L 400 250",
                        "M 230 430 L 320 430 L 400 250", "M 500 250 L 550 250",
                        "M 710 160 L 820 250", "M 710 250 L 820 250",
                        "M 710 340 L 820 250", "M 820 250 L 850 250"
                    ].map((d, i) => (
                        <motion.path
                            key={`blue-${i}`}
                            d={d}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="1.5"
                            className="animate-premium-dash-blue"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 2.2 + i * 0.05 }}
                        />
                    ))}
                </svg>

                {/* Left Column Nodes */}
                <motion.div
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                    variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
                    }}
                    className="absolute left-[50px] top-[50px] flex flex-col gap-[50px]"
                >
                    {[
                        { icon: "folder_open", label: "Student Records" },
                        { icon: "description", label: "Resume Data" },
                        { icon: "school", label: "Academic History" },
                        { icon: "business_center", label: "Internships" },
                        { icon: "grid_view", label: "Skill Matrix" }
                    ].map((node) => (
                        <motion.div
                            key={node.label}
                            variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}
                            whileHover={{ scale: 1.05, borderColor: "#2563eb" }}
                            className="w-[180px] h-[40px] bg-white border-2 border-black p-1 relative z-10 transition-colors"
                        >
                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                            <div className="w-full h-full border border-dashed border-black flex items-center px-3 gap-3">
                                <span className="material-symbols-outlined text-[18px]">{node.icon}</span>
                                <span className="text-xs font-semibold">{node.label}</span>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Center Node */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    whileHover={{ scale: 1.05 }}
                    className="absolute left-[400px] top-[200px] w-[100px] h-[100px] bg-white border-2 border-black p-1 flex items-center justify-center z-10"
                >
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-20">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={`in-${i}`}
                                className="absolute w-2 h-[2px] bg-blue-600 animate-data-input"
                                style={{ left: '10px', top: `${25 + i * 12}px`, animationDelay: `${i * 0.2}s` }}
                            />
                        ))}
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={`out-${i}`}
                                className="absolute w-3 h-[2px] bg-blue-600 animate-data-output"
                                style={{ right: '10px', top: `${25 + i * 12}px`, animationDelay: `${i * 0.2 + 0.5}s` }}
                            />
                        ))}
                    </div>
                    <div className="w-full h-full border border-dashed border-black flex items-center justify-center relative z-10">
                        <img src="/brand/logo.png" alt="PlacePro Engine" className="w-12 h-12 object-contain animate-engine-rotate" />
                    </div>
                </motion.div>

                {/* Right Column Nodes */}
                <motion.div
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                    variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.8 } }
                    }}
                    className="absolute left-[550px] top-[140px] flex flex-col gap-[50px]"
                >
                    {[
                        "01. Top Candidate",
                        "02. Shortlisted",
                        "03. Qualified"
                    ].map((label) => (
                        <motion.div
                            key={label}
                            variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}
                            whileHover={{ scale: 1.05, borderColor: "#2563eb" }}
                            className="w-[160px] h-[40px] bg-white border-2 border-black p-1 relative z-10 transition-colors"
                        >
                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                            <div className="w-full h-full border border-dashed border-black flex items-center px-3 z-10">
                                <span className="text-xs font-semibold">{label}</span>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Final Result Node */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="absolute left-[850px] top-[180px] flex flex-col items-center z-10"
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest mb-3 text-neutral-500">
                        FINAL RESULT
                    </span>
                    <motion.div
                        whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(37,99,235,0.1)" }}
                        className="min-w-[200px] border-2 border-black bg-white p-1 relative z-10 transition-all"
                    >
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                        <div className="w-full h-full border border-dashed border-black flex flex-col justify-center px-4 py-3 gap-2">
                            <div className="flex justify-between items-center text-xs gap-4">
                                <span className="font-medium text-gray-600">Placed Students</span>
                                <span className="font-bold tabular-nums">~{placedCount}%</span>
                            </div>
                            <div className="flex justify-between items-center text-xs gap-4">
                                <span className="font-medium text-gray-600">Avg CTC</span>
                                <span className="font-bold tabular-nums">~₹{avgCtc} LPA</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
                </div>
            </motion.div>
        </>
    );
}
