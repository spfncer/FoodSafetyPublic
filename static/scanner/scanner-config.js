document.addEventListener("DOMContentLoaded", function () {
  let manualForm = document.querySelector("#manualForm");
  const startScanBtn = document.getElementById("start-scan");
  let scanResults = new Map();

  let scannerIsRunning = false;
  let manualOpen = false;
  let searchMethodBtn = document.querySelector("#searchMethod");

  let serverSends = 0;
  let barcodeFoundPill = document.querySelector("#barcodeFoundPill");
  let noMatchPill = document.querySelector("#noMatchPill");
  let ternary = true;

  let modal = document.querySelector("#itemDesc");

  manualForm.addEventListener("submit", function (event) {
    event.preventDefault();
    let value = manualForm.querySelector("#manualEntry").value
    value = value.replace(/\s/g, '');
    const barcodeValue = validateUPC(value);
    if (barcodeValue) {
        queryServer(barcodeValue);
        manualForm.querySelector("#manualEntry").value = "";
    }
    else{
      console.log("Invalid barcode entered");
    }
  });

  function changeSearch(){
    if(ternary){
      ternary = false;
      searchMethodBtn.querySelector("span").innerText = "Ternary"
      searchMethodBtn.setAttribute("title", "Searching using Jump Search");
    }
    else{
      ternary = true;
      searchMethodBtn.querySelector("span").innerText = "Jump"
      searchMethodBtn.setAttribute("title", "Searching using Ternary Search");
    }
  }

  window.changeSearch = changeSearch;

  function showManual(){
    let manualbtn = document.querySelector("#manual");
    if(!manualOpen){
      manualOpen = true;
      manualbtn.innerText = "Close Manual Entry";
      manualForm.classList.remove("hidden");
      if(scannerIsRunning){
        startScanBtn.innerText = "Start Scanning";
        Quagga.stop();
        serverSends = 0;
        barcodeFoundPill.classList.add("hidden");
      }
    }
    else{
      manualbtn.innerText = "Manual Entry";
      manualForm.classList.add("hidden");
      manualOpen = false;
    }
  }
  window.showManual = showManual;

  function validateUPC(upcCode) {
    if (/^\d{6,12}$/.test(upcCode)) {
      return upcCode.replace(/^0+/, '');
    } else {
      return false;
    }
  }

  function queryServer(barcodeValue) {
    console.log("Sending barcode to server:", barcodeValue);
    serverSends++;
    fetch('/searchbarcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barcode: barcodeValue, method: (ternary ? "ternary" : "jump") }),
    })
      .then(response => response.json())
      .then(data => {
        // Process the response from the server
        if (data.status === "BAD" && !scannerIsRunning){
          barcodeFoundPill.classList.add("hidden");
          noMatchPill.classList.remove("hidden");
          setTimeout(function(){
            noMatchPill.classList.add("hidden");
          }, 4000);
          }
          else if (data.status==="BAD && scannerIsRunning"){
            serverSends++;
            if (serverSends > 10){
              barcodeFoundPill.classList.add("hidden");
              noMatchPill.classList.remove("hidden");
              scanResults.clear();
              serverSends = 0;
            }
        }
        else if (data.status === "OK"){
          modal.querySelector("h2#descTitle").innerText = data.title;
          modal.querySelector("p#descContent").innerText = "No harmful ingredients found!";
          modal.querySelector("p#elapsedTime>strong").innerText = data.time;
          modal.showModal();
          serverSends = 0;
          window.stop();
          barcodeFoundPill.classList.add("hidden");
        }
        else if (data.status === "A"){
          modal.querySelector("h2#descTitle").innerText = data.title;
          modal.querySelector("p#descContent").innerText = "Contains the following allergens: " + data.allergens;
          modal.querySelector("p#elapsedTime>strong").innerText = data.time;
          modal.showModal();
          serverSends = 0;
          window.stop();
          barcodeFoundPill.classList.add("hidden");
        }
        else if (data.status === "H"){
          modal.querySelector("h2#descTitle").innerText = data.title;
          modal.querySelector("p#descContent").innerText = "Contains the following harmful ingredients: " + data.harmfuls;
          modal.querySelector("p#elapsedTime>strong").innerText = data.time;
          modal.showModal();
          serverSends = 0;
          window.stop();
          barcodeFoundPill.classList.add("hidden");
        }
        else if (data.status === "AH"){
          modal.querySelector("h2#descTitle").innerText = data.title;
          modal.querySelector("p#descContent").innerText = "Contains the following allergens:\n" + data.allergens + "\nContains the following harmful ingredients:\n" + data.harmfuls;
          modal.querySelector("p#elapsedTime>strong").innerText = data.time;
          modal.showModal();
          serverSends = 0;
          window.stop();
          barcodeFoundPill.classList.add("hidden");
        }
      })
      .catch(error => {
        // Handle error, if any
        console.log(error);
        if (serverSends > 5) {
          barcodeFoundPill.classList.add("hidden");
          noMatchPill.classList.remove("hidden");
          scanResults.clear();
          serverSends = 0;
        }
      });
  }

  function onDetected(result) {
    console.log("Found barcode: " + result.codeResult.code);
    barcodeFoundPill.classList.remove("hidden");
    const barcodeValue = result.codeResult.code;
    // Check if the barcode is already in the map
    if (scanResults.has(barcodeValue)) {
      //if its already in the map, and not 0 (which means its not valid)
      if (scanResults.get(barcodeValue) !== 0)
        //increment the value
        scanResults.set(barcodeValue, scanResults.get(barcodeValue) + 1);
      if (scanResults.get(barcodeValue) > 5) {
        //if the value is greater than 5, send it to the server provided it's valid
        validatedUPC = validateUPC(barcodeValue);
        if (validatedUPC) {
          queryServer(validatedUPC);
        }
        else
          //if it's not valid, set the value to 0 so it's ignored now
          console.log("Marked as invalid: " + barcodeValue);
          scanResults.set(barcodeValue, 0);
      }
    } else {
      // Add the barcode to the map with an initial value of 1
      scanResults.set(barcodeValue, 1);
    }
  }

  function startScanner() {
    Quagga.init(
      {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.getElementById("scanner"),
          constraints: {
            facingMode: "environment", // Use the back camera (change to 'user' for front camera)
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
          readers: ["upc_reader"], // Adjust this array based on the barcode types you want to support
        },
        locate: true,
      },

      function (err) {
        if (err) {
          console.error("Error initializing Quagga:", err);
          return;
        }
        Quagga.start();
        scannerIsRunning = true;
        console.log("Quagga initialized.");
        if(manualOpen){
          showManual();
        }
      }
    );
  }

  startScanBtn.addEventListener("click", function () {
    if (!scannerIsRunning) {
      startScanner();
      scannerRan = true;
      startScanBtn.innerText = "Stop Scanning";
    }
    else {
      Quagga.stop();
      serverSends = 0;
      scannerIsRunning = false;
      startScanBtn.innerText = "Start Scanning";
      barcodeFoundPill.classList.add("hidden");
    }
  });

  // Stop the scanner when leaving the page to free up camera resources
  window.addEventListener("beforeunload", function () {
    if (scannerIsRunning) {
      Quagga.stop();
    }
  });

  // Handle barcode detection
  Quagga.onDetected(onDetected);

  function closeResults(){
    const modal = document.querySelector("#itemDesc");
    modal.close();
    modal.querySelector("h2#descTitle").innerText = "Title";
    modal.querySelector("p#descContent").innerText = "Content";
  }

  window.closeResults = closeResults;

});
