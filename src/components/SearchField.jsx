import React, { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./ui/input.jsx";
import { Button } from "./ui/button.jsx";

export default function SearchField({ value, onChange, placeholder }) {
  const input = useRef(null);
  return <div className="desk-search">
    <Search size={17} aria-hidden="true"/>
    <Input ref={input} type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)}
      className="h-9 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"/>
    {value && <Button size="icon-xs" variant="ghost" aria-label="Clear search" onClick={() => { onChange(""); input.current?.focus(); }}><X/></Button>}
  </div>;
}
