import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { importAddresses } from '../../utils/importAddresses'

// One place to fix column mapping if the real Master_Map_routing.xlsm headers
// differ from what's documented in CLAUDE.md. Keys are normalised
// (lowercased, non-alphanumeric stripped) before matching against these aliases.
const COLUMN_ALIASES = {
  region: ['region', 'area'],
  mapNumber: ['mapnumber', 'mapno', 'map'],
  mapSub: ['mapsub', 'sub', 'submap'],
  suburb: ['suburb', 'town'],
  streetNumber: ['streetnumber', 'streetno', 'houseno', 'housenumber', 'number', 'no'],
  unit: ['unit', 'flat', 'apartment', 'apt'],
  streetName: ['streetname', 'street', 'address'],
  motherTongue: ['mothertongue', 'language', 'tongue'],
}

const PHASE_LABEL = {
  checking: 'Checking for existing addresses',
  geocoding: 'Geocoding new addresses (rate-limited — this is the slow part)',
  writing: 'Writing to Firestore',
}

function normalizeKey(key) {
  return String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildFieldResolver(headerRow) {
  const normalizedHeaders = headerRow.map((h) => ({ raw: h, norm: normalizeKey(h) }))
  const resolved = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = normalizedHeaders.find((h) => aliases.includes(h.norm))
    if (match) resolved[field] = match.raw
  }
  return resolved
}

function rowsToImportShape(rawRows, fieldMap) {
  return rawRows
    .map((raw) => ({
      region: String(raw[fieldMap.region] ?? '').trim(),
      mapNumber: Number(raw[fieldMap.mapNumber] ?? 0) || String(raw[fieldMap.mapNumber] ?? '').trim(),
      mapSub: String(raw[fieldMap.mapSub] ?? '').trim(),
      suburb: String(raw[fieldMap.suburb] ?? '').trim(),
      streetNumber: String(raw[fieldMap.streetNumber] ?? '').trim(),
      unit: String(raw[fieldMap.unit] ?? '').trim(),
      streetName: String(raw[fieldMap.streetName] ?? '').trim(),
      motherTongue: String(raw[fieldMap.motherTongue] ?? '').trim(),
    }))
    .filter((row) => row.streetName && row.suburb)
}

export default function ImportPage() {
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [workbook, setWorkbook] = useState(null)
  const [rows, setRows] = useState([])
  const [fieldMap, setFieldMap] = useState(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ phase: 'checking', done: 0, total: 0 })
  const [summary, setSummary] = useState(null)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    getDocs(collection(db, 'groups')).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setGroups(list)
      if (list.length === 1) setGroupId(list[0].id)
    })
  }, [])

  // No server to keep working if the tab closes — geocoding runs in-browser.
  useEffect(() => {
    if (!importing) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [importing])

  const parseSheet = (wb, sheetName) => {
    const sheet = wb.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    if (rawRows.length === 0) {
      setParseError('That sheet has no data rows.')
      setRows([])
      return
    }
    const map = buildFieldResolver(Object.keys(rawRows[0]))
    const missing = ['region', 'suburb', 'streetNumber', 'streetName'].filter((f) => !map[f])
    if (missing.length > 0) {
      setParseError(
        `Couldn't find columns for: ${missing.join(', ')}. Adjust COLUMN_ALIASES in ImportPage.jsx to match the real headers.`,
      )
      setFieldMap(map)
      setRows([])
      return
    }
    setParseError('')
    setFieldMap(map)
    setRows(rowsToImportShape(rawRows, map))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSummary(null)
    setImportError('')

    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' })
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      const defaultSheet = wb.SheetNames.find((n) => !/howlong/i.test(n)) || wb.SheetNames[0]
      setSelectedSheet(defaultSheet)
      parseSheet(wb, defaultSheet)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName)
    if (workbook) parseSheet(workbook, sheetName)
  }

  const startImport = async () => {
    if (!groupId || rows.length === 0) return
    setImporting(true)
    setImportError('')
    setSummary(null)
    setProgress({ phase: 'checking', done: 0, total: rows.length })

    try {
      const result = await importAddresses({ rows, groupId, onProgress: setProgress })
      setSummary(result)
    } catch (err) {
      setImportError(err.message || 'Import failed partway through — safe to retry, already-imported rows are skipped.')
    } finally {
      setImporting(false)
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Import data</h1>

      <div className="card mb-6 space-y-4">
        <div>
          <label className="label" htmlFor="file">Master_Map_routing.xlsm</label>
          <input
            id="file"
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={handleFile}
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/40 dark:file:text-brand-300 dark:hover:file:bg-brand-900/60"
          />
        </div>

        {sheetNames.length > 0 && (
          <div>
            <label className="label" htmlFor="sheet">Sheet</label>
            <select id="sheet" className="input" value={selectedSheet} onChange={(e) => handleSheetChange(e.target.value)}>
              {sheetNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {groups.length > 0 && (
          <div>
            <label className="label" htmlFor="group">Import into group</label>
            <select id="group" className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        {parseError && <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}
      </div>

      {rows.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Preview — {rows.length} address{rows.length === 1 ? '' : 'es'} found
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-1 pr-4">Region</th>
                  <th className="py-1 pr-4">Map</th>
                  <th className="py-1 pr-4">Suburb</th>
                  <th className="py-1 pr-4">Address</th>
                  <th className="py-1 pr-4">Mother tongue</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <td className="py-1 pr-4">{row.region}</td>
                    <td className="py-1 pr-4">{row.mapNumber}{row.mapSub}</td>
                    <td className="py-1 pr-4">{row.suburb}</td>
                    <td className="py-1 pr-4">{row.streetNumber} {row.unit && `Unit ${row.unit}`} {row.streetName}</td>
                    <td className="py-1 pr-4">{row.motherTongue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={!groupId || importing}
            onClick={startImport}
            className="btn-primary mt-4"
          >
            {importing ? 'Importing…' : `Import ${rows.length} addresses`}
          </button>
        </div>
      )}

      {importing && (
        <div className="card mb-6">
          <div className="mb-2 flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{PHASE_LABEL[progress.phase]} — {progress.done} of {progress.total}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Geocoding runs in this browser tab (no server available on the free plan) — please keep it open until this finishes.
          </p>
        </div>
      )}

      {importError && <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>}

      {summary && (
        <div className="card border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Import complete</p>
          <ul className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            <li>{summary.imported} addresses imported</li>
            <li>{summary.skipped} already existed (skipped)</li>
            {summary.geocodeFailures > 0 && <li>{summary.geocodeFailures} addresses failed to geocode — lat/lng left blank</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
