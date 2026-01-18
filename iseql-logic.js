document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. INITIALIZATION & MOCK DATABASE
  // ==========================================

  updateDropdowns();

  const saveBtn = document.getElementById("save-event-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const eventName = document.getElementById("event-name").value;
      if (!eventName) {
        alert("Please name your event in Step 0 before saving.");
        return;
      }
      const eventData = { name: eventName, date: new Date().toISOString() };
      let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      if (library.find((e) => e.name === eventName)) {
        alert("Unique name required.");
        return;
      }
      library.push(eventData);
      localStorage.setItem("iseql_library", JSON.stringify(library));
      alert(`Saved "${eventName}"!`);
      updateDropdowns();
    });
  }

  function updateDropdowns() {
    const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
    const selectors = [
      document.getElementById("op1-predicate"),
      document.getElementById("op2-predicate"),
    ];

    selectors.forEach((select) => {
      select.querySelectorAll(".dynamic-option").forEach((opt) => opt.remove());
      if (library.length > 0) {
        const separator = document.createElement("option");
        separator.textContent = "--- SAVED EVENTS ---";
        separator.disabled = true;
        separator.className = "dynamic-option";
        select.appendChild(separator);
        library.forEach((evt) => {
          const option = document.createElement("option");
          option.value = "EXISTING";
          option.textContent = `Event: ${evt.name}`;
          option.dataset.realName = evt.name;
          option.className = "dynamic-option";
          select.appendChild(option);
        });
      }
    });
  }

  // Auto-fill existing names
  ["op1", "op2"].forEach((prefix) => {
    const select = document.getElementById(`${prefix}-predicate`);
    if (select) {
      select.addEventListener("change", function () {
        const selectedOption = this.options[this.selectedIndex];
        const inputContainer = document.getElementById(
          `${prefix}-existing-container`,
        );
        const nameInput = document.getElementById(`${prefix}-existing-name`);
        if (this.value === "EXISTING") {
          inputContainer.classList.remove("hidden");
          if (selectedOption.dataset.realName)
            nameInput.value = selectedOption.dataset.realName;
        } else {
          inputContainer.classList.add("hidden");
        }
      });
    }
  });

  // ==========================================
  // 2. UI LOGIC (Updated for Step 3)
  // ==========================================

  const relationRadios = document.getElementsByName("temp-relation");
  const seqOptions = document.getElementById("sequential-options");
  const overlapOptions = document.getElementById("overlapping-options");
  const overlapTypeSelect = document.getElementById("overlap-type");
  const labelDelta = document.getElementById("label-delta");
  const labelEpsilon = document.getElementById("label-epsilon");
  const containerEpsilon = document.getElementById("container-epsilon");

  function updateRelationUI() {
    const selected = document.querySelector(
      'input[name="temp-relation"]:checked',
    ).value;
    if (selected === "sequential") {
      seqOptions.style.display = "block";
      overlapOptions.style.display = "none";
    } else {
      seqOptions.style.display = "none";
      overlapOptions.style.display = "block";
      updateOverlapInputs();
    }
  }

  function updateOverlapInputs() {
    const type = overlapTypeSelect.value;
    containerEpsilon.style.display = "block";
    document.getElementById("overlap-delta").parentElement.style.display =
      "block";
    if (type === "DJ") {
      labelDelta.textContent = "Max Start Delay [δ]";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else if (type === "SP") {
      labelDelta.textContent = "Max Start Delay [δ]";
      containerEpsilon.style.display = "none";
    } else if (type === "EF") {
      document.getElementById("overlap-delta").parentElement.style.display =
        "none";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else {
      // LOJ
      labelDelta.textContent = "Start Point Distance [δ]";
      labelEpsilon.textContent = "End Point Distance [ε]";
    }
  }

  relationRadios.forEach((r) => r.addEventListener("change", updateRelationUI));
  if (overlapTypeSelect)
    overlapTypeSelect.addEventListener("change", updateOverlapInputs);
  updateRelationUI();

  // --- EXPANDED CONSTRAINT BUILDER ---
  const addConstraintBtn = document.getElementById("add-constraint-btn");
  const constraintsList = document.getElementById("constraints-list");

  if (addConstraintBtn) {
    addConstraintBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "constraint-row input-group";
      row.style.display = "flex";
      row.style.gap = "5px";
      row.style.marginBottom = "10px";

      // Expanded Variable List
      const variableOptions = `
    <option value="M1.arg1">M1.arg1 (Primary Actor)</option>
    <option value="M1.arg2">M1.arg2 (Secondary Actor)</option>
    <option value="M1.arg3">M1.arg3 (Object/Item)</option> <option value="M1.sf">M1.sf (Start Frame)</option>
    <option value="M1.ef">M1.ef (End Frame)</option>
    
    <option value="M2.arg1">M2.arg1 (Primary Actor)</option>
    <option value="M2.arg2">M2.arg2 (Secondary Actor)</option>
    <option value="M2.arg3">M2.arg3 (Object/Item)</option> <option value="M2.sf">M2.sf (Start Frame)</option>
    <option value="M2.ef">M2.ef (End Frame)</option>
`;
      row.innerHTML = `
                <select class="c-op1" style="flex:1">${variableOptions}</select>
                
                <select class="c-operator" style="width:60px">
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value="<">&lt;</option>
                    <option value=">">&gt;</option>
                    <option value="<=">&le;</option>
                    <option value=">=">&ge;</option>
                </select>
                
                <select class="c-op2" style="flex:1">${variableOptions}</select>
                
                <input type="text" class="c-modifier" placeholder="+0" style="width:50px; text-align:center;">

                <button class="btn remove-btn" style="background:#e74c3c; width:auto; padding: 0 10px;">X</button>
            `;

      row
        .querySelector(".remove-btn")
        .addEventListener("click", () => row.remove());
      constraintsList.appendChild(row);
    });
    addConstraintBtn.click();
  }

  // ==========================================
  // 3. GENERATION LOGIC (UPDATED)
  // ==========================================

  document
    .getElementById("generate-btn")
    .addEventListener("click", generateISEQL);

  function generateISEQL() {
    const op1 = buildOperandString("op1", "M1");
    const op2 = buildOperandString("op2", "M2");

    let operatorString = "";
    const relationType = document.querySelector(
      'input[name="temp-relation"]:checked',
    ).value;

    // --- 1. SEQUENTIAL LOGIC UPDATE ---
    if (relationType === "sequential") {
      const order = document.getElementById("seq-order").value;
      const gap = document.getElementById("seq-max-gap").value;
      let opCode = order === "before" ? "Bef" : "Aft";

      // If user provides a gap, use it (e.g. BDPE where delta=1)
      if (gap && gap.trim() !== "") {
        operatorString = `${opCode}_{δ=${gap}}`;
      } else {
        // If NO gap provided, default to variable 'd' (max allowed)
        operatorString = `${opCode}_{δ=d}`;
      }
    }
    // --- 2. OVERLAPPING LOGIC ---
    else {
      const type = overlapTypeSelect.value;
      const delta = document.getElementById("overlap-delta").value;
      const epsilon = document.getElementById("overlap-epsilon").value;
      let params = [];

      // Logic: If input exists use it, otherwise use 'd' (default variable)
      const dVal = delta ? delta : "d";
      const eVal = epsilon ? epsilon : "d";

      if (type === "DJ") {
        params.push(`δ=${dVal}`);
        params.push(`ε=${eVal}`);
      } else if (type === "SP") {
        params.push(`δ=${dVal}`);
      } else if (type === "EF") {
        params.push(`ε=${eVal}`);
      } else {
        // LOJ
        params.push(`δ=${dVal}`);
        params.push(`ε=${eVal}`);
      }

      operatorString = `${type}_{${params.join(", ")}}`;
    }

    // --- 3. CONSTRAINTS UPDATE (Handling modifiers) ---
    let constraints = [];
    document.querySelectorAll(".constraint-row").forEach((row) => {
      const left = row.querySelector(".c-op1").value;
      const op = row.querySelector(".c-operator").value;
      const right = row.querySelector(".c-op2").value;
      const mod = row.querySelector(".c-modifier").value; // e.g. "+ 1"

      // Check if modifier has value other than empty or +0
      let rightSide = right;
      if (mod && mod !== "+0" && mod.trim() !== "") {
        rightSide = `${right} ${mod}`;
      }

      constraints.push(`${left} ${op} ${rightSide}`);
    });
    const constraintString =
      constraints.length > 0 ? constraints.join(" ∧ ") : "True";

    // --- 4. OUTPUT ---
    const isExclusion = document.getElementById("exclusion-mode").checked;
    // Standard Schema: Arg1 (Actor1), Arg2 (Actor2), Arg3 (Object/Item), SF, EF
    // We assume M1.arg1 is Actor1, M2.arg1 is Actor2 (if different), and M1.arg2 is the Object.
    const projectionFields =
      "M1.arg1 AS arg1, M2.arg1 AS arg2, M1.arg2 AS arg3, M1.sf, M2.ef";
    let finalExpression = "";

    if (isExclusion) {
      finalExpression = `
π_{ M1.arg1, M1.arg2, M1.sf, M1.ef } (
  ( ${op1} ) 
  MINUS 
  ( ${op2} ) 
  WHERE ${constraintString}
)`;
    } else {
      finalExpression = `
π_{ ${projectionFields} } (
  σ_{ ${constraintString} } (
    ${op1} 
    ${operatorString} 
    ${op2}
  ) 
)`;
    }

    const eventName =
      document.getElementById("event-name").value || "UnnamedEvent";

    const finalOutput = `-- ISEQL Definition for ${eventName}
CREATE OR REPLACE FUNCTION ${eventName} (source VARCHAR) 
RETURNS TABLE (arg1 varchar, arg2 varchar, arg3 varchar, sf integer, ef integer) AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM 
    ${finalExpression};
END;
$$ LANGUAGE plpgsql;`;

    document.getElementById("output-area").value = finalOutput;
  }

  function buildOperandString(prefix, label) {
    const pred = document.getElementById(`${prefix}-predicate`).value;
    if (pred === "EXISTING") {
      const existName =
        document.getElementById(`${prefix}-existing-name`).value || "EventX";
      return `${existName}(${label})`;
    }
    const arg1 = document.getElementById(`${prefix}-arg1`).value;
    const arg2 = document.getElementById(`${prefix}-arg2`).value;
    let parts = [`pred="${pred}"`];
    if (arg1) parts.push(`arg1="${arg1}"`);
    if (arg2) parts.push(`arg2="${arg2}"`);
    return `σ_{ ${parts.join(" ∧ ")} }(${label})`;
  }
});
