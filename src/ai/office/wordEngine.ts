/**
 * Word Document Automation Engine for FloatGPT
 * Provides production-grade PowerShell COM recipes for Microsoft Word (.docx) documents.
 * Supports both headless file processing and LIVE IN-PLACE manipulation of currently open Word windows.
 */

export const WordEngine = {
  /**
   * Universal helper to attach to the currently active/open Word instance,
   * or open a file if not currently running.
   */
  getLiveActiveWordScript(operationCode: string, fallbackFilePath?: string): string {
    const escapedFallback = fallbackFilePath ? fallbackFilePath.replace(/'/g, "''") : '';
    return `
$word = $null;
$isLiveActive = $false;

try {
    # Attempt to attach to currently open Word window
    $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application');
    $isLiveActive = $true;
} catch {
    # Fallback to creating a new visible instance if not open
    $word = New-Object -ComObject Word.Application;
    $word.Visible = $true;
}

if (-not $word) {
    throw "Could not initialize Word instance.";
}

$word.DisplayAlerts = 0;

$doc = $word.ActiveDocument;
if (-not $doc -and '${escapedFallback}') {
    $doc = $word.Documents.Open('${escapedFallback}');
}

if (-not $doc) {
    if ($word.Documents.Count -gt 0) {
        $doc = $word.Documents.Item(1);
    } else {
        $doc = $word.Documents.Add();
    }
}

# --- EXECUTE OPERATION ---
${operationCode}

# If it was an existing file, save changes
if ($doc.Path) {
    $doc.Save();
}

# If attached to active session, leave Word open so user sees result
if ($isLiveActive) {
    "Live Word operation completed successfully on active document: " + $doc.Name;
} else {
    "Word operation completed successfully.";
}
`.trim();
  },

  /**
   * Append a new Heading and Paragraph into the currently open Word document live.
   */
  getLiveAppendSectionScript(heading: string, body: string): string {
    const opCode = `
$pHead = $doc.Paragraphs.Add();
$pHead.Range.Text = '${heading.replace(/'/g, "''")}';
$pHead.Range.Font.Bold = $true;
$pHead.Range.Font.Size = 14;
$pHead.Range.InsertParagraphAfter();

$pBody = $doc.Paragraphs.Add();
$pBody.Range.Text = '${body.replace(/'/g, "''")}';
$pBody.Range.Font.Bold = $false;
$pBody.Range.Font.Size = 11;
$pBody.Range.InsertParagraphAfter();
`;
    return this.getLiveActiveWordScript(opCode);
  },

  /**
   * Insert a styled Table into the currently open Word document live.
   */
  getLiveInsertTableScript(headers: string[], rows: string[][]): string {
    const numRows = rows.length + 1;
    const numCols = headers.length;

    let cellAssignments = '';
    headers.forEach((h, cIdx) => {
      cellAssignments += `$table.Cell(1, ${cIdx + 1}).Range.Text = '${h.replace(/'/g, "''")}'; `;
    });

    rows.forEach((row, rIdx) => {
      row.forEach((val, cIdx) => {
        cellAssignments += `$table.Cell(${rIdx + 2}, ${cIdx + 1}).Range.Text = '${String(val).replace(/'/g, "''")}'; `;
      });
    });

    const opCode = `
$tableRange = $doc.Paragraphs.Add().Range;
$table = $doc.Tables.Add($tableRange, ${numRows}, ${numCols});
$table.Borders.Enable = $true;

# Populate cells
${cellAssignments}

# Style Header Row
$table.Rows.Item(1).Range.Font.Bold = $true;
$table.Rows.Item(1).Range.Shading.BackgroundPatternColor = 12566463; # Light Gray
$table.Columns.AutoFit();
$table.Range.InsertParagraphAfter();
`;
    return this.getLiveActiveWordScript(opCode);
  },

  /**
   * Find and replace text inside the currently OPEN active Word document live.
   */
  getLiveFindAndReplaceScript(findText: string, replaceText: string): string {
    const opCode = `
$find = $doc.Content.Find;
$find.Text = '${findText.replace(/'/g, "''")}';
$find.Replacement.Text = '${replaceText.replace(/'/g, "''")}';
$find.Forward = $true;
$find.Wrap = 1; # wdFindContinue
$find.Execute($find.Text, $false, $false, $false, $false, $false, $true, 1, $false, $find.Replacement.Text, 2) | Out-Null;
`;
    return this.getLiveActiveWordScript(opCode);
  },

  /**
   * Recipe to create a rich Microsoft Word document with Title, Headings, Paragraphs, and a styled Table.
   */
  getCreateDocumentScript(
    filePath: string,
    title: string,
    sections: { heading?: string; body: string }[],
    table?: { headers: string[]; rows: string[][] }
  ): string {
    const escapedFilePath = filePath.replace(/'/g, "''");
    const escapedTitle = title.replace(/'/g, "''");

    let sectionCode = '';
    sections.forEach((sec, idx) => {
      if (sec.heading) {
        sectionCode += `
$pHead${idx} = $doc.Paragraphs.Add();
$pHead${idx}.Range.Text = '${sec.heading.replace(/'/g, "''")}';
$pHead${idx}.Range.Font.Bold = $true;
$pHead${idx}.Range.Font.Size = 14;
$pHead${idx}.Range.Font.ColorIndex = 2; # Blue color
$pHead${idx}.Range.InsertParagraphAfter();
`;
      }
      sectionCode += `
$pBody${idx} = $doc.Paragraphs.Add();
$pBody${idx}.Range.Text = '${sec.body.replace(/'/g, "''")}';
$pBody${idx}.Range.Font.Bold = $false;
$pBody${idx}.Range.Font.Size = 11;
$pBody${idx}.Range.Font.ColorIndex = 0; # Black color
$pBody${idx}.Range.InsertParagraphAfter();
`;
    });

    let tableCode = '';
    if (table && table.headers.length > 0 && table.rows.length > 0) {
      const numRows = table.rows.length + 1;
      const numCols = table.headers.length;

      let cellAssignments = '';
      table.headers.forEach((h, cIdx) => {
        cellAssignments += `$table.Cell(1, ${cIdx + 1}).Range.Text = '${h.replace(/'/g, "''")}'; `;
      });

      table.rows.forEach((row, rIdx) => {
        row.forEach((val, cIdx) => {
          cellAssignments += `$table.Cell(${rIdx + 2}, ${cIdx + 1}).Range.Text = '${String(val).replace(/'/g, "''")}'; `;
        });
      });

      tableCode = `
$tableRange = $doc.Paragraphs.Add().Range;
$table = $doc.Tables.Add($tableRange, ${numRows}, ${numCols});
$table.Borders.Enable = $true;

# Populate table cells
${cellAssignments}

# Style Header Row
$table.Rows.Item(1).Range.Font.Bold = $true;
$table.Rows.Item(1).Range.Shading.BackgroundPatternColor = 12566463; # Light Slate Gray
$table.Columns.AutoFit();
$table.Range.InsertParagraphAfter();
`;
    }

    return `
$word = New-Object -ComObject Word.Application;
$word.Visible = $false;
$word.DisplayAlerts = 0;
$doc = $word.Documents.Add();

# Document Title
$titleP = $doc.Paragraphs.Add();
$titleP.Range.Text = '${escapedTitle}';
$titleP.Range.Font.Bold = $true;
$titleP.Range.Font.Size = 20;
$titleP.Range.Font.Name = 'Segoe UI';
$titleP.Range.InsertParagraphAfter();

# Sections
${sectionCode}

# Table
${tableCode}

$doc.SaveAs2('${escapedFilePath}');
$doc.Close();
$word.Quit();
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null;
"Word document created successfully at: ${escapedFilePath}";
`.trim();
  },

  /**
   * Recipe to search and replace text in an existing Word document.
   */
  getFindAndReplaceScript(filePath: string, findText: string, replaceText: string): string {
    const escapedFilePath = filePath.replace(/'/g, "''");
    const escapedFind = findText.replace(/'/g, "''");
    const escapedReplace = replaceText.replace(/'/g, "''");

    return `
$word = New-Object -ComObject Word.Application;
$word.Visible = $false;
$word.DisplayAlerts = 0;
$doc = $word.Documents.Open('${escapedFilePath}');

$find = $doc.Content.Find;
$find.Text = '${escapedFind}';
$find.Replacement.Text = '${escapedReplace}';
$find.Forward = $true;
$find.Wrap = 1; # wdFindContinue
$find.Execute($find.Text, $false, $false, $false, $false, $false, $true, 1, $false, $find.Replacement.Text, 2) | Out-Null;

$doc.Save();
$doc.Close();
$word.Quit();
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null;
"Replaced occurrences of '${escapedFind}' with '${escapedReplace}' in ${escapedFilePath}.";
`.trim();
  },

  /**
   * Recipe to extract all text and count words/paragraphs from an existing Word document.
   */
  getInspectDocumentScript(filePath: string): string {
    const escapedFilePath = filePath.replace(/'/g, "''");
    return `
$word = New-Object -ComObject Word.Application;
$word.Visible = $false;
$word.DisplayAlerts = 0;
$doc = $word.Documents.Open('${escapedFilePath}');

$wordCount = $doc.Words.Count;
$paraCount = $doc.Paragraphs.Count;
$tableCount = $doc.Tables.Count;
$preview = ($doc.Paragraphs | Select-Object -First 5 | ForEach-Object { $_.Range.Text.Trim() }) -join [Environment]::NewLine;

$doc.Close($false);
$word.Quit();
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null;
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null;

[PSCustomObject]@{
    FilePath = '${escapedFilePath}';
    Words = $wordCount;
    Paragraphs = $paraCount;
    Tables = $tableCount;
    Preview = $preview;
} | Format-List;
`.trim();
  }
};
