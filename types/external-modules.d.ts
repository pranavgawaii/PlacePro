declare module "jszip" {
  export default class JSZip {
    file(name: string, data: ArrayBuffer | Uint8Array | Buffer | string): JSZip;
    generateAsync(options: { type: "nodebuffer" }): Promise<Buffer>;
  }
}

declare module "puppeteer-core" {
  export interface PDFOptions {
    format?: string;
    printBackground?: boolean;
  }

  export interface Page {
    setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
    pdf(options?: PDFOptions): Promise<Buffer>;
  }

  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface LaunchOptions {
    args?: string[];
    defaultViewport?: { width: number; height: number } | null;
    executablePath?: string;
    headless?: boolean | "shell";
  }

  export function launch(options?: LaunchOptions): Promise<Browser>;

  const _default: { launch: typeof launch };
  export default _default;
}

declare module "@sparticuz/chromium" {
  const chromium: {
    args: string[];
    defaultViewport: { width: number; height: number } | null;
    executablePath: () => Promise<string>;
    headless: boolean | "shell";
  };

  export default chromium;
}

declare module "react-day-picker" {
  import type { ComponentPropsWithoutRef } from "react";

  export type DayPickerProps = ComponentPropsWithoutRef<"div">;
  export function DayPicker(props: DayPickerProps): JSX.Element;
}

declare module "cmdk" {
  import type { ComponentPropsWithoutRef, ReactNode } from "react";

  export namespace Command {
    function Input(props: ComponentPropsWithoutRef<"input">): JSX.Element;
    function List(props: { children?: ReactNode; className?: string }): JSX.Element;
    function Empty(props: { children?: ReactNode; className?: string }): JSX.Element;
    function Group(props: { children?: ReactNode; heading?: string; className?: string }): JSX.Element;
    function Separator(props: { className?: string }): JSX.Element;
    function Item(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  }

  export function Command(props: { children?: ReactNode; className?: string }): JSX.Element;
}

declare module "@radix-ui/react-dropdown-menu" {
  import type { ComponentPropsWithoutRef, ReactNode } from "react";

  export function Root(props: { children?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }): JSX.Element;
  export function Trigger(props: ComponentPropsWithoutRef<"button"> & { asChild?: boolean }): JSX.Element;
  export function Content(props: ComponentPropsWithoutRef<"div"> & { align?: "start" | "center" | "end" }): JSX.Element;
  export function Item(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function Label(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function Separator(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function CheckboxItem(props: ComponentPropsWithoutRef<"div"> & { checked?: boolean }): JSX.Element;
  export function Sub(props: { children?: ReactNode }): JSX.Element;
  export function SubTrigger(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function SubContent(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function Portal(props: { children?: ReactNode }): JSX.Element;
}

declare module "@radix-ui/react-popover" {
  import type { ComponentPropsWithoutRef, ReactNode } from "react";

  export function Root(props: { children?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }): JSX.Element;
  export function Trigger(props: ComponentPropsWithoutRef<"button"> & { asChild?: boolean }): JSX.Element;
  export function Content(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function Portal(props: { children?: ReactNode }): JSX.Element;
}

declare module "@radix-ui/react-tabs" {
  import type { ComponentPropsWithoutRef, ReactNode } from "react";

  export function Root(props: ComponentPropsWithoutRef<"div"> & { value?: string; defaultValue?: string; onValueChange?: (value: string) => void }): JSX.Element;
  export function List(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function Trigger(props: ComponentPropsWithoutRef<"button"> & { value: string }): JSX.Element;
  export function Content(props: ComponentPropsWithoutRef<"div"> & { value: string }): JSX.Element;
}

declare module "@radix-ui/react-tooltip" {
  import type { ComponentPropsWithoutRef, ReactNode } from "react";

  export function Provider(props: { children?: ReactNode }): JSX.Element;
  export function Root(props: { children?: ReactNode }): JSX.Element;
  export function Trigger(props: ComponentPropsWithoutRef<"button"> & { asChild?: boolean }): JSX.Element;
  export function Content(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function Portal(props: { children?: ReactNode }): JSX.Element;
}
