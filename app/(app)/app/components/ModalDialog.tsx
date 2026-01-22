"use client";

import { useEffect } from "react";

type ModalDialogProps = {
	open: boolean;
	title: string;
	onClose: () => void;
	children: React.ReactNode;
};

export function ModalDialog({
	open,
	title,
	onClose,
	children,
}: ModalDialogProps) {
	useEffect(() => {
		if (!open) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			onClick={(event) => {
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
		>
			<div className="w-full max-w-2xl rounded border border-slate-800 bg-slate-950 p-4 shadow-xl">
				<div className="flex items-center justify-between border-b border-slate-800 pb-2">
					<h3 className="text-sm font-semibold text-slate-200">{title}</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
					>
						Close
					</button>
				</div>
				<div className="mt-3 text-xs">{children}</div>
			</div>
		</div>
	);
}
