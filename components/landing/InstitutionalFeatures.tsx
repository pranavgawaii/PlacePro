"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function InstitutionalFeatures() {
    const [isWindowFocused, setIsWindowFocused] = useState(false);
    const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');

    const institutions = [
        { icon: "school", name: "IIT Bombay" },
        { icon: "menu_book", name: "BITS Pilani" },
        { icon: "history_edu", name: "NIT Trichy" },
        { icon: "science", name: "IIIT Hyderabad" },
        { icon: "architecture", name: "VIT Vellore" }
    ];

    return (
        <motion.section
            id="features"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="border-b-2 border-black bg-[#FAFAFA] bg-grid-paper px-4 py-20 sm:px-8"
            style={{ backgroundSize: "24px 24px" }}
        >
            <div className="max-w-[1200px] mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mx-auto mb-12 max-w-[1200px] text-center"
                >
                    <h2 className="mb-6 font-serif text-3xl text-black sm:text-4xl lg:text-5xl">
                        Unified Platform <br />
                        <span className="italic font-light">Full Stack Application Suite</span>
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed font-light">
                        Everything required to build placement drives and manage student
                        lifecycles on a single, high-fidelity platform.
                    </p>
                </motion.div>

                <div className="space-y-12">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="md:hidden"
                    >
                        <div className="overflow-hidden rounded-[28px] border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.12)]">
                            <div className="border-b-2 border-black bg-neutral-100 px-4 py-4">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                                    Product Preview
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("student")}
                                        className={[
                                            "rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-colors",
                                            activeTab === "student"
                                                ? "border-black bg-black text-white"
                                                : "border-black bg-white text-black"
                                        ].join(" ")}
                                    >
                                        Student Portal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("admin")}
                                        className={[
                                            "rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-colors",
                                            activeTab === "admin"
                                                ? "border-black bg-black text-white"
                                                : "border-black bg-white text-black"
                                        ].join(" ")}
                                    >
                                        Admin Desk
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-4">
                                {activeTab === "student" ? (
                                    <div className="space-y-4">
                                        <div className="rounded-[24px] border-2 border-black bg-blue-600 p-5 text-white">
                                            <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Student Experience</p>
                                            <h3 className="mt-2 text-xl font-bold">A dashboard students actually use</h3>
                                            <p className="mt-2 text-sm leading-6 text-blue-100">
                                                Applications, resume building, and job tracking stay in one clean workflow.
                                            </p>
                                        </div>
                                        <div className="grid gap-3">
                                            <div className="rounded-[22px] border-2 border-black bg-white p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-bold text-black">Readiness Score</p>
                                                        <p className="text-xs text-neutral-500">Updated from profile and resume data</p>
                                                    </div>
                                                    <div className="text-2xl font-bold text-black">82%</div>
                                                </div>
                                            </div>
                                            <div className="rounded-[22px] border-2 border-black bg-white p-4">
                                                <p className="text-sm font-bold text-black">Recommended Roles</p>
                                                <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <p className="text-sm font-semibold text-black">Software Engineer</p>
                                                            <p className="text-xs text-neutral-500">Google • Bangalore</p>
                                                        </div>
                                                        <span className="text-xs font-bold text-blue-600">98% Match</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="rounded-[24px] border-2 border-black bg-black p-5 text-white">
                                            <p className="text-xs uppercase tracking-[0.2em] text-neutral-300">Admin Control</p>
                                            <h3 className="mt-2 text-xl font-bold">One surface for the full placement engine</h3>
                                            <p className="mt-2 text-sm leading-6 text-neutral-300">
                                                Manage students, recruiters, communication, and reporting from one operating layer.
                                            </p>
                                        </div>
                                        <div className="grid gap-3">
                                            <div className="rounded-[22px] border-2 border-black bg-white p-4">
                                                <p className="text-sm font-bold text-black">Institutional Overview</p>
                                                <div className="mt-3 flex items-end justify-between">
                                                    <div>
                                                        <p className="text-2xl font-bold text-black">1,102</p>
                                                        <p className="text-xs text-neutral-500">Total placements this cycle</p>
                                                    </div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Live</p>
                                                </div>
                                            </div>
                                            <div className="rounded-[22px] border-2 border-black bg-white p-4">
                                                <p className="text-sm font-bold text-black">Recent Activity</p>
                                                <div className="mt-3 space-y-2">
                                                    {[
                                                        "Aman Sharma applied to Microsoft",
                                                        "Adobe Q4 drive initialized"
                                                    ].map((log) => (
                                                        <div key={log} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-black">
                                                            {log}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Premium Student Dashboard Mockup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 40 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative mx-auto hidden max-w-[1000px] perspective-1000 md:block"
                    >
                        {/* Browser Window Frame (Premium Brave-inspired) */}
                        <div className="bg-[#f0f1f4] rounded-xl border-2 border-black overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative z-10 transition-shadow hover:shadow-[0_48px_80px_-20px_rgba(0,0,0,0.4)]">
                            <div className="bg-[#e7e9ed] border-b-2 border-black">
                                <div className="flex items-end px-4 pt-2.5 gap-0.5 h-11 select-none">
                                    {/* OS Window Controls */}
                                    <div className="flex gap-2 mr-6 mb-3">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/10"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10"></div>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex items-end gap-0 px-2 mt-auto h-full">
                                        {/* Student Tab */}
                                        <div
                                            onClick={() => setActiveTab('student')}
                                            className="relative cursor-pointer select-none group h-[34px]"
                                        >
                                            <div className={`px-5 h-full rounded-t-lg text-[11px] font-bold flex items-center gap-2.5 min-w-[160px] transition-all relative z-10 ${activeTab === 'student'
                                                    ? 'bg-white text-black border-t-2 border-x-2 border-black -mb-[2px]'
                                                    : 'bg-neutral-200/50 text-neutral-500 border-b-2 border-black'
                                                }`}>
                                                <img src="/brand/logo.png" className="w-3.5 h-3.5 object-contain" alt="" />
                                                <span className="truncate">Student Portal</span>
                                                <button className="ml-auto flex items-center justify-center w-4 h-4 hover:bg-neutral-100 rounded-sm opacity-0 group-hover:opacity-100">
                                                    <span className="material-symbols-outlined text-[10px] font-bold">close</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Admin Tab */}
                                        <div
                                            onClick={() => setActiveTab('admin')}
                                            className="relative cursor-pointer select-none group h-[34px]"
                                        >
                                            <div className={`px-5 h-full rounded-t-lg text-[10px] font-semibold flex items-center gap-2 min-w-[150px] transition-all relative z-10 ${activeTab === 'admin'
                                                    ? 'bg-white text-black border-t-2 border-x-2 border-black -mb-[2px]'
                                                    : 'bg-neutral-200/50 text-neutral-500 border-b-2 border-black'
                                                }`}>
                                                <img src="/brand/logo.png" className={`w-3.5 h-3.5 object-contain ${activeTab === 'admin' ? '' : 'grayscale opacity-50'}`} alt="" />
                                                <span className="truncate">Admin Dashboard</span>
                                                <button className="ml-auto flex items-center justify-center w-4 h-4 hover:bg-neutral-100 rounded-sm opacity-0 group-hover:opacity-100 font-bold">
                                                    <span className="material-symbols-outlined text-[10px]">close</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* New Tab Button */}
                                        <div className="h-[34px] flex items-center px-2">
                                            <div className="p-1 hover:bg-black/5 rounded transition-colors cursor-pointer group border-b-2 border-transparent hover:border-black/5">
                                                <span className="material-symbols-outlined text-[20px] text-neutral-500 group-hover:text-black block font-light">add</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Address Bar Area */}
                                <div className="bg-white py-2.5 px-4 border-t-2 border-black flex items-center gap-4 relative z-20">
                                    <div className="flex items-center gap-4 text-neutral-400">
                                        <span className="material-symbols-outlined text-[18px] hover:text-black cursor-pointer">arrow_back</span>
                                        <span className="material-symbols-outlined text-[18px] hover:text-black cursor-pointer">arrow_forward</span>
                                        <span className="material-symbols-outlined text-[18px] hover:text-black cursor-pointer">refresh</span>
                                    </div>
                                    <div className="flex-1 bg-neutral-100 border border-black/5 rounded-md px-4 py-1.5 text-xs text-neutral-600 flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[14px] text-emerald-600 font-bold">lock</span>
                                        <span className="font-medium">placepro.in<span className="text-neutral-400">/{activeTab}/dashboard</span></span>
                                        <span className="material-symbols-outlined text-[14px] ml-auto text-neutral-400">star</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-neutral-500">
                                        <span className="material-symbols-outlined text-[18px] hover:text-black cursor-pointer">extension</span>
                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">A</div>
                                    </div>
                                </div>
                            </div>

                            {/* Viewport Content Area */}
                            <div
                                className="flex flex-col w-full h-[520px] sm:h-[600px] bg-white relative text-left overflow-hidden group"
                                onMouseEnter={() => setIsWindowFocused(true)}
                                onMouseLeave={() => setIsWindowFocused(false)}
                            >
                                <AnimatePresence mode="wait">
                                    {activeTab === 'student' ? (
                                        <motion.div
                                            key="student-portal"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                            className="flex flex-col w-full h-full bg-white border-x-2 border-black max-w-full sm:max-w-[calc(100%-128px)] mx-auto relative overflow-hidden"
                                        >
                                            <header className="sticky top-0 z-50 bg-white border-b-2 border-black h-14 flex items-center justify-between px-4 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <img src="/brand/logo.png" className="w-6 h-6 object-contain" alt="" />
                                                    <span className="text-base font-bold tracking-tight text-black">PlacePro <span className="text-blue-600 font-medium ml-1">Student</span></span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 bg-neutral-100 rounded border border-neutral-200 overflow-hidden">
                                                        <img alt="Profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuV20ocktuWldNth-yM9LJQdPONxjzsiCYEBLeGRAfJf0iISKTJOWyBEGv-I6INFmmVqfyBzwQMwc3OQKT5YyTNewHYasZqo_3Izfz1Yc9SP9bWc3O2LPMKU_tmBSwjfVnCoXWypj9s36J9p09paEMT9ow9cKLZFitQVfn2gXXbP5fbKCjhOn0-EaCh8JUzcveor0O3G_aCjrLrJq_8-RPZ4oUTTfUDP461Oc6jyYvy1kG5zEy82dwZLYbDtD9bYi5h8ZOadayxl9G" />
                                                    </div>
                                                </div>
                                            </header>

                                            <div className="flex flex-1 overflow-hidden">
                                                <aside className="w-48 border-r-2 border-black bg-white flex flex-col p-3 space-y-1">
                                                    <div className="flex items-center gap-2.5 px-3 py-2 bg-black text-white rounded text-xs font-medium">
                                                        Dashboard
                                                    </div>
                                                    <div className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 text-xs font-medium">
                                                        Job Board
                                                    </div>
                                                    <div className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 text-xs font-medium">
                                                        Applications
                                                    </div>
                                                </aside>
                                                <main className={`flex-1 bg-neutral-50/30 p-5 ${isWindowFocused ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                        <div className="bg-blue-600 rounded-xl border-2 border-black p-6 text-white">
                                                            <h1 className="text-xl font-bold mb-1">Welcome, Arjun</h1>
                                                            <p className="text-blue-100 text-[10px]">Your profile is looking strong this week.</p>
                                                        </div>
                                                        <div className="bg-white rounded-xl border-2 border-black p-4 flex items-center justify-center">
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold">82%</div>
                                                                <div className="text-[10px] text-neutral-400">Readiness</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-lg border-2 border-black mb-6">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <h3 className="font-bold text-sm">Recommended Roles</h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="p-3 border-2 border-black bg-white flex justify-between items-center">
                                                                <div>
                                                                    <div className="text-xs font-bold">Software Engineer</div>
                                                                    <div className="text-[10px] text-neutral-500">Google • Bangalore</div>
                                                                </div>
                                                                <div className="text-green-600 text-[10px] font-bold">98% Match</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </main>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="admin-portal"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                            className="flex flex-col w-full h-full bg-white border-x-2 border-black max-w-full sm:max-w-[calc(100%-128px)] mx-auto relative overflow-hidden"
                                        >
                                            <header className="sticky top-0 z-50 bg-white border-b-2 border-black h-14 flex items-center justify-between px-4 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <img src="/brand/logo.png" className="w-6 h-6 object-contain" alt="" />
                                                    <span className="text-base font-bold tracking-tight text-black">PlacePro <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] ml-1 uppercase font-bold">Admin</span></span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 bg-neutral-100 rounded border border-neutral-200 overflow-hidden">
                                                        <div className="w-full h-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">A</div>
                                                    </div>
                                                </div>
                                            </header>

                                            <div className="flex flex-1 overflow-hidden">
                                                <aside className="w-48 border-r-2 border-black bg-white flex flex-col p-3 space-y-1">
                                                    <div className="flex items-center gap-2.5 px-3 py-2 bg-black text-white rounded text-xs font-medium">
                                                        Dashboard
                                                    </div>
                                                    <div className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 text-xs font-medium">
                                                        Students
                                                    </div>
                                                    <div className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 text-xs font-medium">
                                                        Companies
                                                    </div>
                                                    <div className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 text-xs font-medium">
                                                        Analytics
                                                    </div>
                                                </aside>
                                                <main className={`flex-1 bg-neutral-50/30 p-5 ${isWindowFocused ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                        <div className="bg-blue-600 rounded-xl border-2 border-black p-6 text-white">
                                                            <h1 className="text-xl font-bold mb-1">Institutional Overview</h1>
                                                            <p className="text-blue-100 text-[10px]">Academic Year 2025-26 • Q3 Active</p>
                                                        </div>
                                                        <div className="bg-white rounded-xl border-2 border-black p-4 flex items-center justify-center">
                                                            <div className="text-center">
                                                                <div className="text-2xl font-bold text-black">1,102</div>
                                                                <div className="text-[10px] text-neutral-400 font-bold uppercase">Total Placements</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-lg border-2 border-black mb-6">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <h3 className="font-bold text-sm">Recent Activity</h3>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {[
                                                                { text: 'Aman Sharma applied to Microsoft', label: '2m ago' },
                                                                { text: 'Adobe Q4 drive initialized', label: '14m ago' }
                                                            ].map((log, i) => (
                                                                <div key={i} className="p-3 border-2 border-black bg-white flex justify-between items-center">
                                                                    <div className="text-xs font-medium text-black">{log.text}</div>
                                                                    <div className="text-[10px] text-neutral-400 font-bold">{log.label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </main>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>

                    {/* Intelligence Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="overflow-hidden border-2 border-black bg-white p-0 shadow-sharp"
                    >
                        <div className="grid md:grid-cols-2">
                            <div className="flex flex-col justify-center border-b-2 border-black p-6 sm:p-8 md:border-b-0 md:border-r-2 md:p-10">
                                <h3 className="mb-4 text-2xl font-bold tracking-tight text-black">
                                    Real-time Intelligence
                                </h3>
                                <p className="mb-8 leading-relaxed text-gray-600">
                                    Visualize placement trends across departments. Export
                                    reports for NBA/NAAC accreditation in one click.
                                </p>
                                <ul className="space-y-4">
                                    {[
                                        "Department-wise breakdown",
                                        "Salary range distribution",
                                        "Recruiter feedback loops"
                                    ].map((text, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-black font-space-mono">
                                            <div className="w-5 h-5 bg-blue-600 border border-black flex items-center justify-center text-white text-[10px]">
                                                ✓
                                            </div>
                                            {text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="relative flex items-center justify-center bg-gray-50 p-6 sm:p-8 md:p-10">
                                <div className="relative z-10 w-full max-w-md border-2 border-black bg-white p-5 shadow-sharp sm:p-6">
                                    <div className="mb-6 border-b border-gray-200 pb-2 font-space-mono text-xs font-bold uppercase text-black">
                                        Placement Performance // Q3
                                    </div>
                                    <div className="flex items-end gap-3 h-40">
                                        {[40, 60, 50, 80, 95].map((h, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ height: 0 }}
                                                whileInView={{ height: `${h}%` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                                                className={`w-full ${i === 4 ? 'bg-blue-600' : 'bg-gray-200'} border border-black`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(0deg, #000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.section>
    );
}
