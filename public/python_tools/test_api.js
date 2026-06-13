fetch('http://localhost:3000/api/records').then(res => res.json()).then(data => {
  if (data.data && data.data.length > 0) {
    const id = data.data[0].id;
    console.log("Found ID:", id);
    fetch('http://localhost:3000/api/records/' + id, {method: 'DELETE'})
      .then(r => r.json())
      .then(d => console.log("DELETE Result:", d))
      .catch(e => console.error("DELETE Error:", e));
  } else {
    console.log("No records found.");
  }
}).catch(e => console.error("GET Error:", e));
