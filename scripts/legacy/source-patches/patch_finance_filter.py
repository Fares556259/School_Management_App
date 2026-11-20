import sys

with open("src/components/FinanceDateFilter.tsx", "r") as f:
    content = f.read()

content = content.replace(
    'export default function FinanceDateFilter() {',
    'export default function FinanceDateFilter({ clientSideOnly, onChangeImmediate, currentClientFrom, currentClientTo }: { clientSideOnly?: boolean; onChangeImmediate?: (from: string, to: string) => void; currentClientFrom?: string; currentClientTo?: string }) {'
)

content = content.replace(
    'const currentFrom = searchParams.get("from") || "";',
    'const currentFrom = clientSideOnly ? (currentClientFrom || "") : (searchParams.get("from") || "");'
)
content = content.replace(
    'const currentTo = searchParams.get("to") || "";',
    'const currentTo = clientSideOnly ? (currentClientTo || "") : (searchParams.get("to") || "");'
)

apply_filter_old = """  const applyFilter = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");
    
    if (to) params.set("to", to);
    else params.delete("to");
    
    // Reset to page 1 when filtering
    params.delete("page");
    
    router.push(`${window.location.pathname}?${params.toString()}`);
    setIsOpen(false);
  };"""

apply_filter_new = """  const applyFilter = (from: string, to: string) => {
    if (clientSideOnly && onChangeImmediate) {
      onChangeImmediate(from, to);
      setIsOpen(false);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");
    
    if (to) params.set("to", to);
    else params.delete("to");
    
    // Reset to page 1 when filtering
    params.delete("page");
    
    router.push(`${window.location.pathname}?${params.toString()}`);
    setIsOpen(false);
  };"""

content = content.replace(apply_filter_old, apply_filter_new)

with open("src/components/FinanceDateFilter.tsx", "w") as f:
    f.write(content)

print("Patched FinanceDateFilter")
