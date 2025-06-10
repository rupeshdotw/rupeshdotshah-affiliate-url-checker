const campaigns = [];

// Auto-detect location on page load
async function detectLocation() {
  const statusIndicator = document.getElementById("country-status");
  const countrySelect = document.getElementById("url-country");

  statusIndicator.textContent = "🔍 Detecting...";
  statusIndicator.className = "status-indicator detecting";

  try {
    // Try multiple IP geolocation services for better reliability
    const services = [
      "https://ipapi.co/json/",
      "https://api.ipgeolocation.io/ipgeo?apiKey=4d32f0da00224e50884faa071df764b9",
      "https://ipinfo.io/json",
    ];

    let locationData = null;

    for (const service of services) {
      try {
        const response = await fetch(service);
        if (response.ok) {
          locationData = await response.json();
          break;
        }
      } catch (e) {
        console.log(`Service ${service} failed, trying next...`);
      }
    }

    if (locationData) {
      // Extract country code from different service formats
      const countryCode =
        locationData.country_code ||
        locationData.country_code2 ||
        locationData.country ||
        locationData.countryCode;

      if (countryCode) {
        // Set the country in the dropdown
        const option = Array.from(countrySelect.options).find(
          (opt) => opt.value.toUpperCase() === countryCode.toUpperCase()
        );

        if (option) {
          countrySelect.value = countryCode.toUpperCase();
          // Trigger Select2 to update
          $(countrySelect).trigger("change");

          statusIndicator.textContent = `✅ ${countryCode.toUpperCase()}`;
          statusIndicator.className = "status-indicator detected";

          // Show city/region if available
          const city = locationData.city || locationData.region_name || "";
          if (city) {
            statusIndicator.title = `Detected: ${city}, ${countryCode.toUpperCase()}`;
          }
        } else {
          throw new Error(`Country ${countryCode} not found in dropdown`);
        }
      } else {
        throw new Error("No country code in response");
      }
    } else {
      throw new Error("All services failed");
    }
  } catch (error) {
    console.error("Location detection failed:", error);
    statusIndicator.textContent = "❌ Failed";
    statusIndicator.className = "status-indicator detect-failed";
    statusIndicator.title =
      "Location detection failed. Please select manually.";

    // Reset to default option
    countrySelect.value = "";
    $(countrySelect).trigger("change");
  }
}

function loadCampaigns() {
  const stored = localStorage.getItem("campaigns");
  if (stored) {
    campaigns.push(...JSON.parse(stored));
    renderTable();
  }
}

//detect location as soon as window load
window.onload = function () {
  loadCampaigns();

  // Set default sorting to newest first
  document.getElementById("sortDate").value = "newest";
  sortTableByDate();

  // Detect location after a short delay to ensure Select2 is initialized
  setTimeout(detectLocation, 1000);
};

function saveCampaigns() {
  localStorage.setItem("campaigns", JSON.stringify(campaigns));
}

function formatDate(date) {
  //return new Date(date).toLocaleString();
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

function isValidURL(str) {
  try {
    new URL(str);
    return true;
  } catch (_) {
    return false;
  }
}

async function resolveFinalUrl(url) {
  try {
    const response = await fetch(`/resolve?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error("Server returned error");
    const data = await response.json();
    return data.finalUrl || url;
  } catch (e) {
    console.error("Error resolving URL:", e.message);
    return "Error resolving";
  }
}

//Function to handle add campaign after adding a new campaign and click on add campaign button
async function addCampaign() {
  const url = document.getElementById("campaign-url").value;
  const tags = document.getElementById("campaign-tags").value;
  const loadingRow = document.getElementById("loadingRow");
  if (!url) return alert("Campaign URL is required");
  if (!tags) return alert("Campaign tags are required");
  if (!isValidURL(url)) return alert("Please enter a valid URL");

  loadingRow.style.display = "table-row";

  const now = new Date();
  const finalUrl = await resolveFinalUrl(url);

  const campaign = {
    id: Date.now(),
    url,
    finalUrl,
    tags,
    date: formatDate(now),
  };

  campaigns.push(campaign);

  // Apply current sorting after adding new campaign
  sortTableByDate();

  saveCampaigns();

  loadingRow.style.display = "none";

  document.getElementById("campaign-url").value = "";
  document.getElementById("campaign-tags").value = "";
}

// Replace your existing refreshAllUrls function with this improved version

async function refreshAllUrls() {
  const refreshBtn = document.getElementById("refreshAllBtn");
  const originalText = refreshBtn.innerHTML;

  // Prevent multiple simultaneous refresh operations
  if (refreshBtn.disabled) {
    showNotification("⚠️ Refresh already in progress", "warning");
    return;
  }

  // Disable button and show loading state
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<span class="loading-spinner"></span>Refreshing...';

  // Store original final URLs as backup
  const originalFinalUrls = campaigns.map((c) => ({
    id: c.id,
    finalUrl: c.finalUrl,
  }));

  // Set all campaigns to loading state
  campaigns.forEach((campaign) => {
    campaign.finalUrl = "Loading...";
  });
  renderTable();

  let successCount = 0;
  let errorCount = 0;

  try {
    // Process campaigns in smaller batches to reduce server load
    const batchSize = 2; // Reduced from 3 to 2 for better stability
    const totalCampaigns = campaigns.length;

    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);
      const currentBatchStart = i + 1;
      const currentBatchEnd = Math.min(i + batchSize, totalCampaigns);

      // Update button with progress
      refreshBtn.innerHTML = `<span class="loading-spinner"></span>Processing ${currentBatchStart}-${currentBatchEnd} of ${totalCampaigns}...`;

      // Process batch with individual error handling
      const batchPromises = batch.map(async (campaign, index) => {
        const campaignNumber = i + index + 1;

        try {
          // Add individual timeout for each URL resolution
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Individual URL timeout")),
              10000
            ); // 10 second timeout per URL
          });

          const resolutionPromise = resolveFinalUrl(campaign.url);

          // Race between resolution and timeout
          const finalUrl = await Promise.race([
            resolutionPromise,
            timeoutPromise,
          ]);

          // Validate the resolved URL
          if (
            !finalUrl ||
            finalUrl === "Loading..." ||
            finalUrl.startsWith("chrome-error://") ||
            finalUrl.includes("chromewebdata")
          ) {
            throw new Error("Invalid resolution result");
          }

          campaign.finalUrl = finalUrl;
          campaign.date = formatDate(new Date()); // Update the date
          successCount++;

          console.log(
            `✅ Campaign ${campaignNumber}/${totalCampaigns} resolved successfully`
          );
        } catch (error) {
          console.error(
            `❌ Campaign ${campaignNumber}/${totalCampaigns} failed:`,
            error.message
          );

          // Restore original URL if available, otherwise set descriptive error
          const originalData = originalFinalUrls.find(
            (orig) => orig.id === campaign.id
          );

          if (
            originalData &&
            originalData.finalUrl !== "Loading..." &&
            originalData.finalUrl !== "Error resolving"
          ) {
            campaign.finalUrl = originalData.finalUrl; // Restore previous working URL
            console.log(
              `🔄 Restored previous URL for campaign ${campaignNumber}`
            );
          } else {
            // Set descriptive error message
            if (
              error.message.includes("timeout") ||
              error.message.includes("Timeout")
            ) {
              campaign.finalUrl = "Timeout - Please try again";
            } else if (
              error.message.includes("Network") ||
              error.message.includes("fetch")
            ) {
              campaign.finalUrl = "Network error";
            } else {
              campaign.finalUrl = "Resolution failed";
            }
          }

          errorCount++;
        }

        // Update table after each URL to show progress
        renderTable();
      });

      // Wait for the current batch to complete
      await Promise.allSettled(batchPromises);

      // Save progress after each batch
      saveCampaigns();

      // Longer delay between batches to be more respectful to servers
      if (i + batchSize < campaigns.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Final update and save
    renderTable();
    saveCampaigns();

    // Show completion notification
    if (errorCount === 0) {
      showNotification(
        `✅ All ${successCount} URLs refreshed successfully!`,
        "success"
      );
    } else if (successCount > 0) {
      showNotification(
        `⚠️ Refresh completed: ${successCount} successful, ${errorCount} failed`,
        "warning"
      );
    } else {
      showNotification(
        `❌ Refresh failed: All ${errorCount} URLs could not be resolved`,
        "error"
      );
    }
  } catch (error) {
    console.error("Critical error during bulk refresh:", error);

    // Attempt to restore original URLs on critical failure
    try {
      originalFinalUrls.forEach((original) => {
        const campaign = campaigns.find((c) => c.id === original.id);
        if (campaign && original.finalUrl !== "Loading...") {
          campaign.finalUrl = original.finalUrl;
        }
      });
      renderTable();
      saveCampaigns();

      showNotification("❌ Refresh failed - Previous URLs restored", "error");
    } catch (restoreError) {
      console.error("Failed to restore original URLs:", restoreError);
      showNotification("❌ Critical refresh failure", "error");
    }
  } finally {
    // Re-enable button with original text
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = originalText;
  }
}

// Add a function to refresh individual URLs
async function refreshSingleUrl(campaignId) {
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) return;

  const originalFinalUrl = campaign.finalUrl;
  campaign.finalUrl = "Loading...";
  renderTable();

  try {
    const finalUrl = await resolveFinalUrl(campaign.url);

    if (
      finalUrl &&
      finalUrl !== "Loading..." &&
      !finalUrl.startsWith("chrome-error://") &&
      !finalUrl.includes("chromewebdata")
    ) {
      campaign.finalUrl = finalUrl;
      campaign.date = formatDate(new Date());
      showNotification("✅ URL refreshed successfully!", "success");
    } else {
      throw new Error("Invalid resolution result");
    }
  } catch (error) {
    console.error("Single URL refresh failed:", error);
    campaign.finalUrl = originalFinalUrl; // Restore original
    showNotification("❌ Failed to refresh URL", "error");
  }

  renderTable();
  saveCampaigns();
}

// Enhanced renderTable function with individual refresh buttons
function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (campaigns.length === 0) {
    const noDatarow = document.createElement("tr");
    noDatarow.innerHTML = `<td colspan="5" style="text-align:center; padding:20px; color:#666; font-style:italic;">No Campaigns Available <span><a href="#campaign-url">Add Campaigns</a></span></td>`;
    tbody.appendChild(noDatarow);
    return;
  }

  campaigns.forEach((c) => {
    const row = document.createElement("tr");
    const isLoading = c.finalUrl === "Loading...";
    const isError =
      c.finalUrl === "Error resolving" ||
      c.finalUrl.includes("Resolution failed") ||
      c.finalUrl.includes("Timeout") ||
      c.finalUrl.includes("Network error");

    let finalUrlContent = "";
    if (isLoading) {
      finalUrlContent = `<span class="status-badge status-loading"><span class="loading-spinner"></span>Loading...</span>`;
    } else if (isError) {
      finalUrlContent = `
            <div class="url-cell">
              <span class="status-badge status-error">❌ ${c.finalUrl}</span>
              <button class="copy-btn refresh-single-btn" onclick="refreshSingleUrl(${c.id})" title="Retry this URL">
                🔄 Retry
              </button>
            </div>
          `;
    } else {
      finalUrlContent = `
            <div class="url-cell">
              <span class="url-text">${c.finalUrl}</span>
              <div class="url-actions">
                <button class="copy-btn refresh-single-btn" onclick="refreshSingleUrl(${c.id})" title="Refresh this URL">
                  🔄 Refresh URL
                </button>
              </div>
            </div>
          `;
    }

    row.innerHTML = `
          <td>${c.date}</td>
          <td contenteditable="true" onblur="updateCampaignURL(${c.id}, this.innerText)">${c.url}</td>
          <td>${finalUrlContent}</td>
          <td contenteditable="true" onblur="updateTags(${c.id}, this.innerText)">${c.tags}</td>
          <td>
            <button class="btn-danger" onclick="confirmDelete(${c.id})">🗑️ Delete</button>
            <button class="copy-btn" onclick="copyToClipboard('${c.finalUrl}')" title="Copy URL">📋 Copy</button>
          </td>
        `;
    tbody.appendChild(row);
  });
}

// Add CSS for the new buttons (add this to your CSS)
const additionalStyles = `
    <style>
    .loading-spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 5px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .url-actions {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }

    .refresh-single-btn {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
      font-size: 12px !important;
      padding: 4px 8px !important;
      min-width: auto !important;
    }

    .refresh-single-btn:hover {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
      transform: translateY(-1px);
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .status-loading {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
    }

    .status-error {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
    }
    </style>
    `;

// Inject the additional styles
if (!document.getElementById("additional-styles")) {
  const styleElement = document.createElement("div");
  styleElement.id = "additional-styles";
  styleElement.innerHTML = additionalStyles;
  document.head.appendChild(styleElement);
}

function updateCampaignURL(id, newUrl) {
  const campaign = campaigns.find((c) => c.id === id);
  if (campaign) {
    campaign.url = newUrl;
    campaign.finalUrl = "Loading...";
    renderTable();
    resolveFinalUrl(newUrl).then((url) => {
      campaign.finalUrl = url;
      renderTable();
      saveCampaigns();
    });
  }
}

function updateTags(id, newTags) {
  const campaign = campaigns.find((c) => c.id === id);
  if (campaign) {
    campaign.tags = newTags;
    saveCampaigns();
  }
}

function confirmDelete(id) {
  if (
    confirm(
      "Are you sure you want to delete this campaign? This action cannot be undone."
    )
  ) {
    deleteCampaign(id);
  }
}
function deleteCampaign(id) {
  const index = campaigns.findIndex((c) => c.id === id);
  if (index !== -1) {
    campaigns.splice(index, 1);
    renderTable();
    saveCampaigns();
  }
}

function deleteTableRows() {
  if (
    confirm(
      "Are you sure you want to delete all entries? This action cannot be undone."
    )
  ) {
    campaigns.splice(0, campaigns.length);
    renderTable();
    saveCampaigns();
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Create a beautiful notification
    const notification = document.createElement("div");
    notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 15px 25px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
          z-index: 1000;
          font-weight: 600;
          animation: fadeInUp 0.3s ease-out;
        `;
    notification.textContent = "✅ Copied to clipboard!";
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  });
}

function exportCSV() {
  let csv = "Date,Campaign URL,Final URL,Tags\n";
  campaigns.forEach((c) => {
    csv += `"${c.date}","${c.url}","${c.finalUrl}","${c.tags}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resolved-urls.csv";
  a.click();
}

function filterTable() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const rows = document
    .getElementById("campaignTable")
    .getElementsByTagName("tr");
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(input) ? "" : "none";
  }
}

//Country Dropdown jquery
$(document).ready(function () {
  // Initialize Select2 on the country select element
  $("#url-country").select2({
    placeholder: "Search for a country",
    allowClear: true,
  });
});

// Flatpickr for date range
flatpickr("#dateRange", {
  mode: "range",
  dateFormat: "d/m/Y",
  onChange: filterByDateRange,
  enableTime: false,
  time_24hr: false,
});

// Sort Table by date
function sortTableByDate() {
  const sortOrder = document.getElementById("sortDate").value;

  campaigns.sort((a, b) => {
    // Handle import order sorting
    if (sortOrder === "import") {
      // If both have original index, sort by that
      if (a.originalIndex !== undefined && b.originalIndex !== undefined) {
        return a.originalIndex - b.originalIndex;
      }
      // If only one has original index, prioritize it
      if (a.originalIndex !== undefined && b.originalIndex === undefined) {
        return -1; // a comes first
      }
      if (a.originalIndex === undefined && b.originalIndex !== undefined) {
        return 1; // b comes first
      }
      // If neither has original index, sort by date (newest first as fallback)
      const dateA = parseDateString(a.date);
      const dateB = parseDateString(b.date);
      return dateB - dateA;
    }

    // Handle date-based sorting
    const dateA = parseDateString(a.date);
    const dateB = parseDateString(b.date);

    // If dates are very close (within same import batch), maintain original order
    const timeDiff = Math.abs(dateA - dateB);
    if (
      timeDiff < 1000 &&
      a.originalIndex !== undefined &&
      b.originalIndex !== undefined
    ) {
      return a.originalIndex - b.originalIndex;
    }

    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  renderTable();
  saveCampaigns();
}

// Add this new helper function to parse your date format
function parseDateString(dateStr) {
  // Parse format: "DD/MM/YYYY, HH:MM:SS"
  const [datePart, timePart] = dateStr.split(", ");
  const [day, month, year] = datePart.split("/");
  const [hours, minutes, seconds] = timePart.split(":");

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

//Function for filter by date range
function filterByDateRange(selectedDates) {
  const [startDate, endDate] = selectedDates;
  const rows = document.querySelectorAll("#campaignTable tbody tr");

  rows.forEach((row) => {
    const dateText = row.cells[0].innerText.trim();
    const rowDate = parseDateString(dateText);

    if (startDate && endDate) {
      // Set time to start and end of day for proper comparison
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const show = rowDate >= start && rowDate <= end;
      row.style.display = show ? "" : "none";
    } else {
      row.style.display = "";
    }
  });
}

function clearDateFilter() {
  // Clear the date range input
  const datePicker = document.querySelector("#dateRange");
  datePicker._flatpickr.clear();

  // Show all rows
  const rows = document.querySelectorAll("#campaignTable tbody tr");
  rows.forEach((row) => (row.style.display = ""));
}

// Add this function to your existing JavaScript code for file upload
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileExtension = file.name.split(".").pop().toLowerCase();

  // Show loading notification
  showNotification("📄 Processing file...", "info");

  try {
    let data = [];

    if (fileExtension === "csv") {
      data = await parseCSVFile(file);
    } else if (fileExtension === "xlsx") {
      data = await parseXLSXFile(file);
    } else {
      throw new Error("Unsupported file format. Please use CSV or XLSX files.");
    }

    // Process the imported data
    await processImportedData(data);

    // Clear the file input
    event.target.value = "";

    showNotification(
      `✅ Successfully imported ${data.length} campaigns!`,
      "success"
    );
  } catch (error) {
    console.error("File import error:", error);
    showNotification(`❌ Import failed: ${error.message}`, "error");

    // Clear the file input on error
    event.target.value = "";
  }
}

// Parse CSV file
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const lines = text.split("\n");
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/"/g, ""));

        // Find column indices (case-insensitive)
        const urlIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("url") ||
            h.toLowerCase().includes("link") ||
            h.toLowerCase().includes("campaign")
        );

        const tagsIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("tag") ||
            h.toLowerCase().includes("note") ||
            h.toLowerCase().includes("description")
        );

        if (urlIndex === -1) {
          throw new Error(
            'No URL column found. Please ensure your CSV has a column with "URL", "Link", or "Campaign" in the header.'
          );
        }

        const data = [];

        // Process data rows (skip header)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          // Simple CSV parsing (handles quoted values)
          const values = parseCSVLine(line);

          if (values.length > urlIndex && values[urlIndex]) {
            const url = values[urlIndex].trim();
            const tags =
              tagsIndex !== -1 && values[tagsIndex]
                ? values[tagsIndex].trim()
                : "";

            if (isValidURL(url)) {
              data.push({ url, tags });
            }
          }
        }

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read CSV file"));
    reader.readAsText(file);
  });
}

// Parse XLSX file
function parseXLSXFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          throw new Error("The Excel file appears to be empty.");
        }

        const headers = jsonData[0].map((h) =>
          String(h || "")
            .trim()
            .toLowerCase()
        );

        // Find column indices
        const urlIndex = headers.findIndex(
          (h) =>
            h.includes("url") || h.includes("link") || h.includes("campaign")
        );

        const tagsIndex = headers.findIndex(
          (h) =>
            h.includes("tag") || h.includes("note") || h.includes("description")
        );

        if (urlIndex === -1) {
          throw new Error(
            'No URL column found. Please ensure your Excel file has a column with "URL", "Link", or "Campaign" in the header.'
          );
        }

        const processedData = [];

        // Process data rows (skip header)
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue; // Skip empty rows

          const url = String(row[urlIndex] || "").trim();
          const tags =
            tagsIndex !== -1 && row[tagsIndex]
              ? String(row[tagsIndex]).trim()
              : "";

          if (url && isValidURL(url)) {
            processedData.push({ url, tags });
          }
        }

        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read Excel file"));
    reader.readAsArrayBuffer(file);
  });
}

// Simple CSV line parser that handles quoted values
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }

  // Add the last value
  values.push(current.trim().replace(/^"|"$/g, ""));

  return values;
}

// Process imported data and resolve URLs while maintaining order and showing batches
async function processImportedData(importedData) {
  if (importedData.length === 0) {
    throw new Error("No valid URLs found in the file.");
  }

  // Show progress
  const progressNotification = document.createElement("div");
  progressNotification.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
        z-index: 1000;
        font-weight: 600;
        min-width: 200px;
    `;
  document.body.appendChild(progressNotification);

  try {
    // Create a map to store campaigns by their original index
    const campaignMap = new Map();
    const batchSize = 3;
    let totalProcessed = 0;

    // Process in batches but maintain order
    for (let i = 0; i < importedData.length; i += batchSize) {
      const batch = importedData.slice(i, i + batchSize);
      const batchStartIndex = i;

      // Update progress
      progressNotification.innerHTML = `📊 Processing batch ${
        Math.floor(i / batchSize) + 1
      }... (${totalProcessed}/${importedData.length} completed)`;

      // Process current batch
      const batchPromises = batch.map(async (item, batchIndex) => {
        const originalIndex = batchStartIndex + batchIndex;

        try {
          const finalUrl = await resolveFinalUrl(item.url);
          const now = new Date();

          const campaign = {
            id: Date.now() + originalIndex, // Sequential IDs
            url: item.url,
            finalUrl: finalUrl,
            tags: item.tags,
            date: formatDate(now),
            originalIndex: originalIndex, // Track original position
            importBatch: Math.floor(i / batchSize), // Track which batch this belongs to
          };

          // Store in map with original index as key
          campaignMap.set(originalIndex, campaign);
          return { success: true, originalIndex, campaign };
        } catch (error) {
          console.error(`Error processing URL ${item.url}:`, error);

          const campaign = {
            id: Date.now() + originalIndex,
            url: item.url,
            finalUrl: "Error resolving",
            tags: item.tags,
            date: formatDate(new Date()),
            originalIndex: originalIndex,
            importBatch: Math.floor(i / batchSize),
          };

          campaignMap.set(originalIndex, campaign);
          return { success: false, originalIndex, campaign };
        }
      });

      // Wait for current batch to complete
      await Promise.all(batchPromises);
      totalProcessed += batch.length;

      // Add completed campaigns to main array in original order
      const orderedCampaigns = [];
      for (let idx = 0; idx < importedData.length; idx++) {
        if (campaignMap.has(idx)) {
          orderedCampaigns.push(campaignMap.get(idx));
        }
      }

      // Add the ordered campaigns to the main campaigns array
      // Remove any previously added import campaigns and add the updated ordered list
      const existingCampaigns = campaigns.filter(
        (c) => c.originalIndex === undefined
      );
      campaigns.length = 0; // Clear array
      campaigns.push(...existingCampaigns, ...orderedCampaigns);

      // Update table and save after each batch
      renderTable();
      saveCampaigns();

      // Update progress with completed count
      progressNotification.innerHTML = `✅ Batch ${
        Math.floor(i / batchSize) + 1
      } completed! (${totalProcessed}/${importedData.length} total)`;

      // Small delay between batches
      if (i + batchSize < importedData.length) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    // Final update
    progressNotification.innerHTML = `🎉 All ${totalProcessed} campaigns processed successfully!`;

    // Clean up originalIndex property after import is complete
    setTimeout(() => {
      campaigns.forEach((campaign) => {
        if (campaign.importBatch !== undefined) {
          delete campaign.importBatch; // Remove only importBatch, keep originalIndex
        }
      });
      saveCampaigns();
    }, 2000);
  } finally {
    // Remove progress notification after a delay
    setTimeout(() => {
      if (progressNotification.parentNode) {
        progressNotification.remove();
      }
    }, 3000);
  }
}

// Add this function to ensure imported data maintains order even after sorting
function preserveImportOrder() {
  // Get the current sort order
  const sortOrder = document.getElementById("sortDate").value;

  // If sorting by newest, imported items should appear at top
  // If sorting by oldest, imported items should appear at bottom
  if (sortOrder === "newest") {
    campaigns.sort((a, b) => {
      const dateA = parseDateString(a.date);
      const dateB = parseDateString(b.date);

      // If dates are very close (within same import batch), maintain original order
      const timeDiff = Math.abs(dateA - dateB);
      if (
        timeDiff < 1000 &&
        a.originalIndex !== undefined &&
        b.originalIndex !== undefined
      ) {
        return a.originalIndex - b.originalIndex;
      }

      return dateB - dateA;
    });
  } else {
    campaigns.sort((a, b) => {
      const dateA = parseDateString(a.date);
      const dateB = parseDateString(b.date);

      // If dates are very close (within same import batch), maintain original order
      const timeDiff = Math.abs(dateA - dateB);
      if (
        timeDiff < 1000 &&
        a.originalIndex !== undefined &&
        b.originalIndex !== undefined
      ) {
        return a.originalIndex - b.originalIndex;
      }

      return dateA - dateB;
    });
  }
}

// Update the showNotification function to handle 'info' type
function showNotification(message, type = "success") {
  const notification = document.createElement("div");

  let bgColor;
  switch (type) {
    case "success":
      bgColor = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
      break;
    case "error":
      bgColor = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
      break;
    case "info":
      bgColor = "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
      break;
    default:
      bgColor = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)";
  }

  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        font-weight: 600;
        animation: fadeInUp 0.3s ease-out;
        max-width: 300px;
      `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 4000);
}
