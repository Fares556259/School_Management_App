const testParent = async () => {
  const res = await fetch("http://localhost:3000/api/mobile/parent?id=parent1");
  console.log(await res.text());
}
testParent();
