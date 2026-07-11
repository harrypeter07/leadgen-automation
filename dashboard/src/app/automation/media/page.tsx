'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

interface MediaAsset {
  name: string
  url: string
  size?: string
  date?: string
  source: 'Supabase CDN' | 'Cloudinary CDN'
}

export default function MediaLibraryPage() {
  const [selectedFolder, setSelectedFolder] = useState<'all' | 'supabase' | 'cloudinary'>('all')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [cloudinaryFolder, setCloudinaryFolder] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const cloudinaryFileRef = useRef<HTMLInputElement>(null)

  // Fetch Cloudinary and fallback assets
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    const list: MediaAsset[] = []
    
    // 1. Fetch Cloudinary assets
    try {
      const folderParam = cloudinaryFolder ? `folder=${encodeURIComponent(cloudinaryFolder)}` : ''
      const res = await fetch(`/api/meta/cloudinary?${folderParam}`)
      const data = await res.json()
      if (res.ok && data.assets) {
        data.assets.forEach((asset: any) => {
          list.push({
            name: asset.publicId,
            url: asset.url,
            size: asset.bytes ? `${Math.ceil(asset.bytes / 1024)} KB` : 'Cloud Storage',
            date: asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
            source: 'Cloudinary CDN'
          })
        })
      }
    } catch (err) {
      console.warn('Could not scan Cloudinary assets:', err)
    }

    // 2. Add fallback/default campaign media assets (Supabase Storage upload history placeholder)
    list.push({
      name: 'campaign_leadgen_promo.png',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60',
      size: '1.8 MB',
      date: new Date().toLocaleDateString(),
      source: 'Supabase CDN'
    })
    list.push({
      name: 'restaurant_outreach_banner.png',
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=60',
      size: '2.5 MB',
      date: new Date().toLocaleDateString(),
      source: 'Supabase CDN'
    })

    setAssets(list)
    setLoading(false)
  }, [cloudinaryFolder])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // Handle uploading files directly
  const handleUpload = async (target: 'supabase' | 'cloudinary') => {
    const input = target === 'supabase' ? fileRef.current : cloudinaryFileRef.current
    const file = input?.files?.[0]
    if (!file) {
      toast.error('Select a file first')
      return
    }

    setUploading(true)
    const toastId = toast.loading(`Uploading to ${target === 'supabase' ? 'Supabase Storage' : 'Cloudinary'}…`)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = target === 'supabase' ? '/api/meta/media-upload' : '/api/meta/cloudinary'
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (res.ok && data.publicUrl) {
        toast.success(`Uploaded successfully! Public URL generated.`, { id: toastId })
        fetchAssets()
        if (input) input.value = ''
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const filteredAssets = selectedFolder === 'all'
    ? assets
    : assets.filter(a => {
        if (selectedFolder === 'supabase') return a.source === 'Supabase CDN'
        return a.source === 'Cloudinary CDN'
      })

  return (
    <div className="space-y-8 select-none text-white animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">🖼️ Media Asset Library</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Upload, organize, and inspect visual media assets, video reels, and Cloudinary templates.</p>
        </div>
        
        {/* Upload controls */}
        <div className="flex flex-wrap gap-2">
          {/* Supabase Upload */}
          <label className="cursor-pointer rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold uppercase tracking-wider px-4 py-3 transition-colors border border-[#2D2D30] flex items-center gap-2">
            <span>📤 Upload to Supabase</span>
            <input 
              type="file" 
              ref={fileRef} 
              className="hidden" 
              onChange={() => handleUpload('supabase')} 
              disabled={uploading}
            />
          </label>

          {/* Cloudinary Upload */}
          <label className="cursor-pointer rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-4 py-3 transition-colors flex items-center gap-2">
            <span>☁️ Upload to Cloudinary</span>
            <input 
              type="file" 
              ref={cloudinaryFileRef} 
              className="hidden" 
              onChange={() => handleUpload('cloudinary')} 
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Left column: Folders sidebar list */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-2">📁 Directories</h3>
            <div className="space-y-1.5 text-xs text-gray-400">
              {[
                { id: 'all', name: '📁 All CDN Assets' },
                { id: 'supabase', name: '📦 Supabase Storage' },
                { id: 'cloudinary', name: '☁️ Cloudinary CDN' }
              ].map(folder => (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id as any)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors flex justify-between font-bold ${
                    selectedFolder === folder.id
                      ? 'text-[#E3B859] bg-[#222225]'
                      : 'hover:bg-[#202022] hover:text-white'
                  }`}
                >
                  <span>{folder.name}</span>
                  <span className="font-mono text-gray-500 text-[10px]">
                    {folder.id === 'all' ? assets.length : assets.filter(a => folder.id === 'supabase' ? a.source === 'Supabase CDN' : a.source === 'Cloudinary CDN').length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cloudinary Folder search settings */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-1.5">⚙️ Cloudinary Scanner</h3>
            <div className="space-y-2">
              <span className="text-[10px] text-gray-500 font-semibold block uppercase">Target Folder Path:</span>
              <input
                type="text"
                placeholder="e.g. campaign1"
                value={cloudinaryFolder}
                onChange={(e) => setCloudinaryFolder(e.target.value)}
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E3B859]"
              />
              <button
                type="button"
                onClick={fetchAssets}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-xs font-bold uppercase rounded-xl transition-colors border border-[#2D2D30]"
              >
                Scan Folder
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Assets grid */}
        <div className="md:col-span-3 space-y-6">
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-2">🖼️ Asset Library</h3>
            
            {loading ? (
              <div className="py-20 text-center text-gray-500 text-xs animate-pulse">Scanning Cloud assets...</div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-20 text-center text-gray-500 text-xs uppercase border border-dashed border-[#2D2D30]/60 rounded-2xl">
                No matching media files found
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {filteredAssets.map((asset, index) => (
                  <div key={index} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl space-y-3.5 flex flex-col justify-between text-xs hover:border-gray-500 transition-all duration-300">
                    <div>
                      {/* Image preview box */}
                      <div className="w-full h-32 bg-gray-900 border border-[#2D2D30]/60 rounded-lg overflow-hidden flex items-center justify-center relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={asset.url} 
                          alt={asset.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            // If preview fails, show a placeholder icon
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                        <span className="absolute text-gray-500 text-2xl group-hover:scale-125 transition-transform duration-300">🖼️</span>
                      </div>
                      
                      <span className="font-bold text-white block truncate mt-2" title={asset.name}>{asset.name}</span>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-semibold uppercase tracking-wider">
                        <span>{asset.size}</span>
                        <span>{asset.date}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#2D2D30]/40 items-center justify-between">
                      <span className="text-[9px] text-[#E3B859] font-black uppercase tracking-wider">{asset.source}</span>
                      <a 
                        href={asset.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 font-bold uppercase tracking-wider text-[9px] text-center"
                      >
                        Open File
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
