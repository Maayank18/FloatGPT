/**
 * Excel Automation Engine for FloatGPT
 * Provides production-grade PowerShell recipes for Excel (.xlsx) and CSV data manipulation.
 * Supports both headless file processing and LIVE IN-PLACE manipulation of currently open Excel windows.
 */

export const ExcelEngine = {
  /**
   * Universal helper to attach to the currently active/open Excel instance,
   * or open a file if not currently running.
   */
  getLiveActiveExcelScript(operationCode: string, fallbackFilePath?: string): string {
    const escapedFallback = fallbackFilePath ? fallbackFilePath.replace(/'/g, "''") : '';
    return `
$excel = $null;
$isLiveActive = $false;

try {
    # Attempt to attach to currently open Excel window
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application');
    $isLiveActive = $true;
} catch {
    # Fallback to creating a new background instance if not currently open
    $excel = New-Object -ComObject Excel.Application;
    $excel.Visible = $true; # Make visible so user can see live results
}

if (-not $excel) {
    throw "Could not initialize Excel instance.";
}

$excel.DisplayAlerts = $false;

$wb = $excel.ActiveWorkbook;
if (-not $wb -and '${escapedFallback}') {
    $wb = $excel.Workbooks.Open('${escapedFallback}');
}

if (-not $wb) {
    if ($excel.Workbooks.Count -gt 0) {
        $wb = $excel.Workbooks.Item(1);
    } else {
        $wb = $excel.Workbooks.Add();
    }
}

$ws = $excel.ActiveSheet;
if (-not $ws) {
    $ws = $wb.Worksheets.Item(1);
}

# --- EXECUTE OPERATION ---
${operationCode}

# If it was an existing file, save changes
if ($wb.Path) {
    $wb.Save();
}

# If attached to active session, leave Excel open so user sees result
if ($isLiveActive) {
    "Live Excel operation completed successfully on active sheet: " + $ws.Name;
} else {
    "Excel operation completed successfully.";
}
`.trim();
  },

  /**
   * Sort the currently OPEN active Excel spreadsheet (or target file) live on screen.
   */
  getLiveSortScript(sortColumnLetter: string = 'A', descending: boolean = false): string {
    const order = descending ? 2 : 1; // 1 = xlAscending, 2 = xlDescending
    const opCode = `
$usedRange = $ws.UsedRange;
$sortKey = $ws.Range('${sortColumnLetter}2');
$usedRange.Sort($sortKey, ${order}, $null, $null, 1, $null, 1, 1) | Out-Null;
$ws.Columns.AutoFit() | Out-Null;
`;
    return this.getLiveActiveExcelScript(opCode);
  },

  /**
   * Calculate and insert Average/Sum/Count formula into the active worksheet live.
   */
  getLiveFormulaScript(targetCell: string, formulaString: string, labelCell?: string, labelText?: string): string {
    let opCode = '';
    if (labelCell && labelText) {
      opCode += `$ws.Range('${labelCell}').Value = '${labelText.replace(/'/g, "''")}';\n`;
      opCode += `$ws.Range('${labelCell}').Font.Bold = $true;\n`;
    }
    opCode += `
$targetRange = $ws.Range('${targetCell}');
$targetRange.Formula = '${formulaString}';
$targetRange.Font.Bold = $true;
$targetRange.Interior.ColorIndex = 36; # Light Yellow Highlight
$ws.Columns.AutoFit() | Out-Null;
`;
    return this.getLiveActiveExcelScript(opCode);
  },

  /**
   * Format the active spreadsheet (headers, bold, background color, auto-fit columns).
   */
  getLiveFormatScript(headerColorIndex: number = 41): string {
    const opCode = `
$usedRange = $ws.UsedRange;
$firstRow = $ws.Rows.Item(1);
$headerRange = $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item(1, $usedRange.Columns.Count));

$headerRange.Font.Bold = $true;
$headerRange.Font.ColorIndex = 2; # White text
$headerRange.Interior.ColorIndex = ${headerColorIndex}; # Colored header
$usedRange.Borders.Weight = 2;
$usedRange.Columns.AutoFit() | Out-Null;
`;
    return this.getLiveActiveExcelScript(opCode);
  },

  /**
   * Recipe to create a new styled Excel spreadsheet with data, formulas, and auto-fitted columns.
   */
  getCreateSpreadsheetScript(filePath: string, sheetName: string, headers: string[], rows: (string | number)[][], formulas?: { cell: string; formula: string }[]): string {
    const escapedFilePath = filePath.replace(/'/g, "''");
    const escapedSheetName = sheetName.replace(/'/g, "''");

    const headerAssignments = headers.map((h, i) => `$ws.Cells.Item(1, ${i + 1}) = '${h.replace(/'/g, "''")}';`).join(' ');
    
    let rowAssignments = '';
    rows.forEach((row, rIdx) => {
      row.forEach((val, cIdx) => {
        const strVal = typeof val === 'number' ? val : `'${String(val).replace(/'/g, "''")}'`;
        rowAssignments += `$ws.Cells.Item(${rIdx + 2}, ${cIdx + 1}) = ${strVal}; `;
      });
    });

    let formulaAssignments = '';
    if (formulas && formulas.length > 0) {
      formulaAssignments = formulas.map(f => `$ws.Range('${f.cell}').Formula = '${f.formula}';`).join(' ');
    }

    return `
$excel = New-Object -ComObject Excel.Application;
$excel.Visible = $false;
$excel.DisplayAlerts = $false;
$wb = $excel.Workbooks.Add();
$ws = $wb.Worksheets.Item(1);
$ws.Name = '${escapedSheetName}';

# Populate Headers
${headerAssignments}

# Style Header Row (Bold, Background Color, Borders)
$headerRange = $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item(1, ${headers.length}));
$headerRange.Font.Bold = $true;
$headerRange.Font.ColorIndex = 2; # White Text
$headerRange.Interior.ColorIndex = 41; # Dark Blue Background
$headerRange.Borders.Weight = 2;

# Populate Rows
${rowAssignments}

# Apply Formulas
${formulaAssignments}

# Auto-fit columns
$ws.UsedRange.Columns.AutoFit() | Out-Null;

$wb.SaveAs('${escapedFilePath}');
$wb.Close();
$excel.Quit();
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null;
"Excel workbook created successfully at: ${escapedFilePath}";
`.trim();
  },

  /**
   * Recipe to sort an existing Excel spreadsheet by a specific column (Ascending/Descending).
   */
  getSortSpreadsheetScript(filePath: string, sortColumnLetter: string, descending: boolean = false, hasHeader: boolean = true): string {
    const escapedFilePath = filePath.replace(/'/g, "''");
    const order = descending ? 2 : 1; // 1 = xlAscending, 2 = xlDescending
    const header = hasHeader ? 1 : 2; // 1 = xlYes, 2 = xlNo

    return `
$excel = New-Object -ComObject Excel.Application;
$excel.Visible = $false;
$excel.DisplayAlerts = $false;
$wb = $excel.Workbooks.Open('${escapedFilePath}');
$ws = $wb.Worksheets.Item(1);

$usedRange = $ws.UsedRange;
$sortKey = $ws.Range('${sortColumnLetter}2');

$usedRange.Sort($sortKey, ${order}, $null, $null, 1, $null, 1, ${header}) | Out-Null;

$wb.Save();
$wb.Close();
$excel.Quit();
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null;
"Sorted spreadsheet by column ${sortColumnLetter} (${descending ? 'Descending' : 'Ascending'}).";
`.trim();
  },

  /**
   * Recipe to compute statistics (Average, Sum, Count, Min, Max) on an Excel column or CSV file.
   */
  getComputeStatsScript(filePath: string, columnNameOrIndex: string | number): string {
    const escapedFilePath = filePath.replace(/'/g, "''");
    return `
if ('${escapedFilePath}'.EndsWith('.csv')) {
    $data = Import-Csv -Path '${escapedFilePath}';
    $stats = $data | Measure-Object -Property '${columnNameOrIndex}' -Average -Sum -Minimum -Maximum;
    [PSCustomObject]@{
        Column = '${columnNameOrIndex}';
        Count = $stats.Count;
        Average = [math]::Round($stats.Average, 2);
        Sum = [math]::Round($stats.Sum, 2);
        Minimum = $stats.Minimum;
        Maximum = $stats.Maximum;
    } | Format-List;
} else {
    $excel = New-Object -ComObject Excel.Application;
    $excel.Visible = $false;
    $excel.DisplayAlerts = $false;
    $wb = $excel.Workbooks.Open('${escapedFilePath}');
    $ws = $wb.Worksheets.Item(1);
    
    $range = $ws.Range('${columnNameOrIndex}');
    $avg = $excel.WorksheetFunction.Average($range);
    $sum = $excel.WorksheetFunction.Sum($range);
    $min = $excel.WorksheetFunction.Min($range);
    $max = $excel.WorksheetFunction.Max($range);
    $count = $excel.WorksheetFunction.Count($range);
    
    $wb.Close($false);
    $excel.Quit();
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null;
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null;
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null;
    
    [PSCustomObject]@{
        Range = '${columnNameOrIndex}';
        Count = $count;
        Average = [math]::Round($avg, 2);
        Sum = [math]::Round($sum, 2);
        Minimum = $min;
        Maximum = $max;
    } | Format-List;
}
`.trim();
  }
};
