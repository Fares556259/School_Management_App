import sys

with open("src/app/(dashboard)/list/students/page.tsx", "r") as f:
    content = f.read()

old_payments = """          payments: { 
            where: {
              month: monthIdx,
              year: yearVal,
            },
            select: { id: true, amount: true, month: true, year: true, status: true, paidAt: true } 
          },"""

new_payments = """          payments: { 
            select: { id: true, amount: true, month: true, year: true, status: true, paidAt: true } 
          },"""

content = content.replace(old_payments, new_payments)

# Since we don't depend on monthIdx, yearVal for caching anymore! Wait!
# getCachedTenantData uses monthIdx, yearVal. If we change month on client, we want the server to return the SAME data regardless of monthIdx.
# So we can remove monthIdx and yearVal from the cache key!
content = content.replace('[p, JSON.stringify(queryParams), monthIdx, yearVal]', '[p, JSON.stringify(queryParams)]')

with open("src/app/(dashboard)/list/students/page.tsx", "w") as f:
    f.write(content)

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "r") as f:
    client_content = f.read()

# Add clientMonthKey state
client_content = client_content.replace(
    'const [clientStatus, setClientStatus] = useState(searchParams.get("status") || "");',
    'const [clientStatus, setClientStatus] = useState(searchParams.get("status") || "");\n  const [clientMonthKey, setClientMonthKey] = useState(selectedMonthKey);'
)

# Replace selectedMonthKey usage with clientMonthKey
client_content = client_content.replace('selectedMonthKey.split(" ")', 'clientMonthKey.split(" ")')
client_content = client_content.replace('monthLabel={selectedMonthKey}', 'monthLabel={clientMonthKey}')
client_content = client_content.replace('monthName={selectedMonthKey}', 'monthName={clientMonthKey}')
client_content = client_content.replace('value={selectedMonthKey}', 'value={clientMonthKey}')

# Update the select onChange
old_onchange = """              onChange={(e) => {
                startTransition(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  const val = e.target.value;
                  if (val) {
                    const [mName, yStr] = val.split(" ");
                    const mIdx = MONTHS.indexOf(mName);
                    params.set("month", `${mIdx}-${yStr}`);
                  } else {
                    params.delete("month");
                  }
                  params.delete("page");
                  router.push(`${pathname}?${params.toString()}`, { scroll: false });
                });
              }}"""

new_onchange = """              onChange={(e) => {
                setClientMonthKey(e.target.value);
              }}"""

client_content = client_content.replace(old_onchange, new_onchange)

with open("src/app/(dashboard)/list/students/StudentListClient.tsx", "w") as f:
    f.write(client_content)

print("Patched client to use instant month")
