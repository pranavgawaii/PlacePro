"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function LandingNavbar() {
    const navItems = ["Product", "Features", "Pricing", "Resources"];

    return (
        <header className="relative z-20 flex h-16 w-full items-center justify-between border-y-2 border-black bg-white px-4 sm:h-[80px] sm:px-8">
            <Link href="/" className="group flex items-center gap-2.5 hover-logo-3d">
                <img src="/brand/logo.png" alt="PlacePro Logo" className="w-8 h-8 object-contain" />
                <span className="text-base font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-blue-600 sm:text-xl">PlacePro</span>
            </Link>

            <nav className="hidden md:flex gap-8 text-[15px] font-medium text-neutral-600">
                {navItems.map((item) => (
                    <Link
                        key={item}
                        className="relative group hover:text-black transition-colors"
                        href={`#${item.toLowerCase()}`}
                    >
                        {item}
                        <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                    </Link>
                ))}
            </nav>

            <div className="relative group hidden md:block">
                <Link href="/login">
                    <button className="bg-black text-white px-6 py-2.5 text-sm font-medium relative hover:bg-blue-600 transition-colors shadow-sm active:translate-y-0.5">
                        Book a Demo
                        <div className="absolute top-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                    </button>
                </Link>
            </div>

            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-50"
                        aria-label="Open navigation"
                    >
                        <Menu className="h-4 w-4" />
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[88vw] max-w-sm bg-white px-5">
                        <SheetTitle className="text-base font-semibold text-neutral-900">Explore</SheetTitle>
                        <div className="mt-6 space-y-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item}
                                    className="block rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-black"
                                    href={`#${item.toLowerCase()}`}
                                >
                                    {item}
                                </Link>
                            ))}
                        </div>
                        <div className="mt-6">
                            <Link
                                href="/login"
                                className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                            >
                                Book a Demo
                            </Link>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </header>
    );
}
