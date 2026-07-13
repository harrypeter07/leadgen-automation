'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

interface MediaAsset {
  name: string
  url: string
  size?: string
  date?: string
  source: 'Supabase CDN' | 'Cloudinary CDN'
  resourceType?: 'image' | 'video'
  duration?: number | null
  format?: string
}

interface UploadItem {
  id: string
  file: File
  progress: number          // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error'
  url?: string
  error?: string
  resourceType: 'image' | 'video'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MediaLibraryPage() {
  const [selectedFolder, setSelectedFolder] = useState<'all' | 'supabase' | 'cloudinary'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [cloudinaryFolder, setCloudinaryFolder] = useState('')
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadFolder, setUploadFolder] = useState('')
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch existing assets ──────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    const list: MediaAsset[] = []

    try {
      const params = new URLSearchParams()
      if (cloudinaryFolder) params.set('folder', cloudinaryFolder)
      if (typeFilter !== 'all') params.set('resource_type', typeFilter)

      const res = await fetch(`/api/meta/cloudinary?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.assets) {
        data.assets.forEach((asset: any) => {
          list.push({
            name: asset.publicId,
            url: asset.url,
            size: asset.bytes ? formatBytes(asset.bytes) : 'Cloud Storage',
            date: asset.createdAt
              ? new Date(asset.createdAt).toLocaleDateString()
              : new Date().toLocaleDateString(),
            source: 'Cloudinary CDN',
            resourceType: asset.resourceType,
            duration: asset.duration,
            format: asset.format,
          })
        })
      }
    } catch (err) {
      console.warn('Could not scan Cloudinary assets:', err)
    }

    // Supabase placeholder assets
    list.push(
      {
        name: 'campaign_leadgen_promo.png',
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60',
        size: '1.8 MB',
        date: new Date().toLocaleDateString(),
        source: 'Supabase CDN',
        resourceType: 'image',
      },
      {
        name: 'restaurant_outreach_banner.png',
        url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=60',
        size: '2.5 MB',
        date: new Date().toLocaleDateString(),
        source: 'Supabase CDN',
        resourceType: 'image',
      }
    )

    setAssets(list)
    setLoading(false)
  }, [cloudinaryFolder, typeFilter])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // ── Direct Cloudinary upload with XMLHttpRequest for progress ─────────────
  const uploadFileDirect = useCallback(
    async (item: UploadItem, folder: string) => {
      try {
        // Step 1: get signature from our API
        const sigRes = await fetch('/api/meta/cloudinary', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder }),
        })
        if (!sigRes.ok) throw new Error('Failed to get upload signature')
        const { timestamp, signature, apiKey, cloudName } = await sigRes.json()

        const resourceType = item.file.type.startsWith('video/') ? 'video' : 'image'

        // Step 2: upload directly to Cloudinary with XHR (supports progress)
        const formData = new FormData()
        formData.append('file', item.file)
        formData.append('timestamp', String(timestamp))
        formData.append('api_key', apiKey)
        formData.append('signature', signature)
        if (folder) formData.append('folder', folder)

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open(
            'POST',
            `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
          )

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setUploadQueue((prev) =>
                prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
              )
            }
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText)
              setUploadQueue((prev) =>
                prev.map((u) =>
                  u.id === item.id
                    ? { ...u, status: 'done', progress: 100, url: data.secure_url }
                    : u
                )
              )
              resolve()
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`))
            }
          }

          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.send(formData)
        })
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: 'error', error: err.message } : u
          )
        )
      }
    },
    []
  )

  // ── Process file list (from input or drop) ────────────────────────────────
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const ACCEPTED = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
        'video/mpeg', 'video/3gpp',
      ]
      const MAX_IMAGE = 20 * 1024 * 1024   // 20 MB
      const MAX_VIDEO = 500 * 1024 * 1024  // 500 MB

      const newItems: UploadItem[] = []
      Array.from(files).forEach((file) => {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name}: unsupported file type`)
          return
        }
        const isVideo = file.type.startsWith('video/')
        const maxSize = isVideo ? MAX_VIDEO : MAX_IMAGE
        if (file.size > maxSize) {
          toast.error(`${file.name}: exceeds ${isVideo ? '500 MB' : '20 MB'} limit`)
          return
        }
        newItems.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          progress: 0,
          status: 'pending',
          resourceType: isVideo ? 'video' : 'image',
        })
      })

      if (newItems.length === 0) return

      setUploadQueue((prev) => [...prev, ...newItems])

      // Start uploading each immediately
      newItems.forEach((item) => {
        setUploadQueue((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading' } : u))
        )
        uploadFileDirect(item, uploadFolder).then(() => {
          // Refresh library after all done
          fetchAssets()
        })
      })

      toast.success(`Queued ${newItems.length} file${newItems.length > 1 ? 's' : ''} for upload`)
    },
    [uploadFileDirect, uploadFolder, fetchAssets]
  )

  // ── Drag and drop handlers ─────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files)
  }

  const filteredAssets = assets.filter((a) => {
    const sourceOk =
      selectedFolder === 'all' ||
      (selectedFolder === 'supabase' && a.source === 'Supabase CDN') ||
      (selectedFolder === 'cloudinary' && a.source === 'Cloudinary CDN')
    const typeOk =
      typeFilter === 'all' || a.resourceType === typeFilter
    return sourceOk && typeOk
  })

  const doneCount = uploadQueue.filter((u) => u.status === 'done').length
  const errorCount = uploadQueue.filter((u) => u.status === 'error').length
  const activeUploads = uploadQueue.filter((u) => u.status === 'uploading')

  return (
    <div className="space-y-6 select-none text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">🖼️ Media Asset Library</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            Upload images &amp; videos to Cloudinary with multi-select and real-time progress.
          </p>
        </div>

        {/* Quick upload button */}
        <label className="cursor-pointer rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-5 py-3 transition-colors flex items-center gap-2 shrink-0">
          <span>☁️ Upload Files</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
        </label>
      </div>

      {/* Upload progress queue */}
      {uploadQueue.length > 0 && (
        <div className="rounded-2xl border border-[#2D2D30] bg-[#0E0E10] p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest">
              📤 Upload Queue — {doneCount}/{uploadQueue.length} done
              {errorCount > 0 && <span className="text-red-400 ml-2">{errorCount} failed</span>}
            </h3>
            {activeUploads.length === 0 && (
              <button
                onClick={() => setUploadQueue([])}
                className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-wider transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {uploadQueue.map((item) => (
              <div key={item.id} className="bg-[#141416] border border-[#2D2D30]/60 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">
                      {item.resourceType === 'video' ? '🎬' : '🖼️'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{item.file.name}</p>
                      <p className="text-[10px] text-gray-500">{formatBytes(item.file.size)}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {item.status === 'done' && <span className="text-green-400 text-lg">✅</span>}
                    {item.status === 'error' && <span className="text-red-400 text-lg">❌</span>}
                    {item.status === 'uploading' && (
                      <span className="text-[10px] font-black text-[#E3B859]">{item.progress}%</span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-[10px] text-gray-500">queued</span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {(item.status === 'uploading' || item.status === 'done') && (
                  <div className="w-full h-1.5 bg-[#2D2D30] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.status === 'done' ? 'bg-green-500' : 'bg-[#E3B859]'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {item.status === 'error' && (
                  <p className="text-[10px] text-red-400">{item.error}</p>
                )}

                {item.status === 'done' && item.url && (
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={item.url}
                      className="flex-1 bg-[#0E0E10] border border-[#2D2D30] rounded-lg px-2 py-1 text-[9px] text-green-300 font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.url!)
                        toast.success('URL copied!')
                      }}
                      className="text-[9px] font-bold text-[#E3B859] hover:text-white uppercase tracking-wider shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Directories */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-2">
              📁 Source
            </h3>
            <div className="space-y-1.5 text-xs text-gray-400">
              {[
                { id: 'all', name: '📁 All Assets' },
                { id: 'supabase', name: '📦 Supabase' },
                { id: 'cloudinary', name: '☁️ Cloudinary' },
              ].map((f) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFolder(f.id as any)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors flex justify-between font-bold ${
                    selectedFolder === f.id
                      ? 'text-[#E3B859] bg-[#222225]'
                      : 'hover:bg-[#202022] hover:text-white'
                  }`}
                >
                  <span>{f.name}</span>
                  <span className="font-mono text-gray-500 text-[10px]">
                    {f.id === 'all'
                      ? assets.length
                      : assets.filter((a) =>
                          f.id === 'supabase'
                            ? a.source === 'Supabase CDN'
                            : a.source === 'Cloudinary CDN'
                        ).length}
                  </span>
                </div>
              ))}
            </div>

            {/* Type filter */}
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-2 pt-2">
              🎞️ Type
            </h3>
            <div className="space-y-1.5 text-xs text-gray-400">
              {[
                { id: 'all', name: '📂 All Media' },
                { id: 'image', name: '🖼️ Images' },
                { id: 'video', name: '🎬 Videos' },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTypeFilter(t.id as any)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors font-bold ${
                    typeFilter === t.id
                      ? 'text-[#E3B859] bg-[#222225]'
                      : 'hover:bg-[#202022] hover:text-white'
                  }`}
                >
                  {t.name}
                </div>
              ))}
            </div>
          </div>

          {/* Cloudinary scan settings */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-1.5">
              ⚙️ Scanner
            </h3>
            <div className="space-y-2">
              <span className="text-[10px] text-gray-500 font-semibold block uppercase">Folder Path</span>
              <input
                type="text"
                placeholder="e.g. campaign1"
                value={cloudinaryFolder}
                onChange={(e) => setCloudinaryFolder(e.target.value)}
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E3B859]"
              />
              <span className="text-[10px] text-gray-500 font-semibold block uppercase mt-1">Upload Folder</span>
              <input
                type="text"
                placeholder="optional folder for uploads"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E3B859]"
              />
              <button
                type="button"
                onClick={fetchAssets}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-xs font-bold uppercase rounded-xl transition-colors border border-[#2D2D30]"
              >
                🔄 Scan Folder
              </button>
            </div>
          </div>
        </div>

        {/* Main content: drop zone + asset grid */}
        <div className="md:col-span-3 space-y-4">
          {/* Drag & Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-[#E3B859] bg-[#E3B859]/5 scale-[1.01]'
                : 'border-[#2D2D30] hover:border-gray-500 bg-[#0E0E10]'
            }`}
          >
            <div className="text-4xl mb-3">{isDragging ? '⬇️' : '☁️'}</div>
            <p className="text-sm font-bold text-gray-300">
              {isDragging ? 'Drop files to upload' : 'Drag & drop images or videos here'}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              or <span className="text-[#E3B859] font-bold">click to browse</span> · Multi-select supported
            </p>
            <div className="flex gap-3 mt-3">
              {['JPG', 'PNG', 'GIF', 'WEBP', 'MP4', 'MOV', 'WEBM'].map((fmt) => (
                <span key={fmt} className="text-[9px] font-black text-gray-600 uppercase tracking-wider border border-[#2D2D30] px-1.5 py-0.5 rounded">
                  {fmt}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Images up to 20 MB · Videos up to 500 MB</p>
          </div>

          {/* Asset grid */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                🖼️ Asset Library — {filteredAssets.length} file{filteredAssets.length !== 1 ? 's' : ''}
              </h3>
            </div>

            {loading ? (
              <div className="py-20 text-center text-gray-500 text-xs animate-pulse">
                Scanning Cloud assets...
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-20 text-center text-gray-500 text-xs uppercase border border-dashed border-[#2D2D30]/60 rounded-2xl">
                No matching media files found
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {filteredAssets.map((asset, index) => {
                  const isVideo = asset.resourceType === 'video'
                  return (
                    <div
                      key={index}
                      className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl space-y-3 flex flex-col justify-between text-xs hover:border-gray-500 transition-all duration-300"
                    >
                      {/* Preview */}
                      <div
                        onClick={() => setPreviewAsset(asset)}
                        className="w-full h-32 bg-gray-900 border border-[#2D2D30]/60 rounded-lg overflow-hidden flex items-center justify-center relative group cursor-pointer"
                      >
                        {isVideo ? (
                          <video
                            src={asset.url}
                            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity duration-300"
                            muted
                            preload="metadata"
                            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                            onMouseLeave={(e) => {
                              const v = e.currentTarget as HTMLVideoElement
                              v.pause()
                              v.currentTime = 0
                            }}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            onError={(e) => {
                              ;(e.target as HTMLElement).style.display = 'none'
                            }}
                          />
                        )}
                        {/* Type badge */}
                        <span className="absolute top-1.5 left-1.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/70 text-white">
                          {isVideo ? '🎬 VIDEO' : '🖼️ IMG'}
                        </span>
                        {isVideo && asset.duration && (
                          <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white font-mono">
                            {formatDuration(asset.duration)}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="font-bold text-white block truncate" title={asset.name}>
                          {asset.name.split('/').pop()}
                        </span>
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-semibold uppercase tracking-wider">
                          <span>{asset.size}</span>
                          <span>{asset.date}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-[#2D2D30]/40 items-center justify-between">
                        <span className="text-[9px] text-[#E3B859] font-black uppercase tracking-wider">
                          {asset.source}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(asset.url)
                              toast.success('URL copied!')
                            }}
                            className="px-2 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 font-bold uppercase tracking-wider text-[9px]"
                          >
                            Copy URL
                          </button>
                          <button
                            onClick={() => setPreviewAsset(asset)}
                            className="px-2 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 font-bold uppercase tracking-wider text-[9px]"
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#18181A] border border-[#2D2D30] rounded-2xl w-full max-w-3xl shadow-2xl text-white overflow-hidden flex flex-col md:flex-row">
            {/* Player / Lightbox */}
            <div className="flex-1 bg-black min-h-[300px] md:min-h-[450px] flex items-center justify-center relative p-4 border-b md:border-b-0 md:border-r border-[#2D2D30]">
              {previewAsset.resourceType === 'video' ? (
                <video
                  src={previewAsset.url}
                  controls
                  autoPlay
                  className="w-full h-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <img
                  src={previewAsset.url}
                  alt={previewAsset.name}
                  className="w-full h-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>

            {/* Side Details */}
            <div className="w-full md:w-80 p-6 flex flex-col justify-between gap-5 bg-[#141416]">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#E3B859] text-[#141416]">
                      {previewAsset.resourceType === 'video' ? '🎬 Video' : '🖼️ Image'}
                    </span>
                    <h4 className="text-sm font-bold mt-2 break-all max-h-16 overflow-y-auto">
                      {previewAsset.name.split('/').pop()}
                    </h4>
                  </div>
                  <button
                    onClick={() => setPreviewAsset(null)}
                    className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#202022] transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#2D2D30]/60">
                    <span className="text-gray-500 font-bold uppercase text-[9px]">Source</span>
                    <span className="font-semibold text-gray-300">{previewAsset.source}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#2D2D30]/60">
                    <span className="text-gray-500 font-bold uppercase text-[9px]">Size</span>
                    <span className="font-semibold text-gray-300">{previewAsset.size}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#2D2D30]/60">
                    <span className="text-gray-500 font-bold uppercase text-[9px]">Date</span>
                    <span className="font-semibold text-gray-300">{previewAsset.date}</span>
                  </div>
                  {previewAsset.format && (
                    <div className="flex justify-between py-1.5 border-b border-[#2D2D30]/60">
                      <span className="text-gray-500 font-bold uppercase text-[9px]">Format</span>
                      <span className="font-semibold text-gray-300 uppercase">{previewAsset.format}</span>
                    </div>
                  )}
                  {previewAsset.resourceType === 'video' && previewAsset.duration && (
                    <div className="flex justify-between py-1.5 border-b border-[#2D2D30]/60">
                      <span className="text-gray-500 font-bold uppercase text-[9px]">Duration</span>
                      <span className="font-semibold text-gray-300 font-mono">
                        {Math.floor(previewAsset.duration / 60)}:{String(Math.floor(previewAsset.duration % 60)).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider block">CDN URL</span>
                  <textarea
                    readOnly
                    value={previewAsset.url}
                    className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl p-2 text-[10px] text-green-300 font-mono h-20 resize-none focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewAsset.url)
                    toast.success('URL copied!')
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider transition-colors text-center"
                >
                  Copy URL
                </button>
                <button
                  onClick={() => setPreviewAsset(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] font-bold text-xs uppercase tracking-wider transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
