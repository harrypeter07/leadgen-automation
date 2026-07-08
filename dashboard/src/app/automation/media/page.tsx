'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function MediaLibraryPage() {
  const [selectedFolder, setSelectedFolder] = useState('all')

  const folders = [
    { id: 'all', name: '📁 All Files', count: 18 },
    { id: 'mockups', name: '📂 Website Mockups', count: 8 },
    { id: 'promos', name: '📂 Cafe Promos', count: 4 },
    { id: 'reels', name: '📂 Video Reels', count: 6 },
  ]

  const mediaAssets = [
    { name: 'mockup_singapore_cafe.png', folder: 'mockups', type: 'image', size: '2.4 MB', date: 'Jul 4, 2026' },
    { name: 'cafe_opening_promo.mp4', folder: 'promos', type: 'video', size: '18.5 MB', date: 'Jul 2, 2026' },
    { name: 'mockup_staging_restaurant.png', folder: 'mockups', type: 'image', size: '3.1 MB', date: 'Jul 1, 2026' },
    { name: 'growth_campaign_audit.pdf', folder: 'all', type: 'document', size: '1.2 MB', date: 'Jun 28, 2026' },
    { name: 'reels_operation_walkthrough.mp4', folder: 'reels', type: 'video', size: '24.1 MB', date: 'Jun 25, 2026' },
  ]

  const filteredAssets = selectedFolder === 'all'
    ? mediaAssets
    : mediaAssets.filter(item => item.folder === selectedFolder)

  const handleUploadFile = () => {
    toast.success('Media asset successfully uploaded to cloud storage! (Mock Trigger)')
  }

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Media Asset Library</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Upload, organize, and inspect visual media assets, video reels, and PDF audit reports.</p>
        </div>
        <button
          onClick={handleUploadFile}
          className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md"
        >
          📤 Upload File
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Left column: Folders sidebar list */}
        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-4 h-fit">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📁 Directories</h3>
          <div className="space-y-1.5 text-xs text-gray-400">
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`p-3 rounded-xl cursor-pointer transition-colors flex justify-between font-bold ${
                  selectedFolder === folder.id
                    ? 'text-[#E3B859] bg-[#222225]'
                    : 'hover:bg-[#202022] hover:text-white'
                }`}
              >
                <span>{folder.name}</span>
                <span className="font-mono text-gray-500 text-[10px]">{folder.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Assets grid */}
        <div className="md:col-span-3 space-y-6">
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">🖼️ Library Grid</h3>
            
            <div className="grid gap-4 sm:grid-cols-3">
              {filteredAssets.map((asset, index) => (
                <div key={index} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl space-y-3.5 flex flex-col justify-between text-xs">
                  <div>
                    <div className="w-full h-32 bg-gray-900 border border-[#2D2D30]/60 rounded-lg flex items-center justify-center text-2xl select-none mb-3">
                      {asset.type === 'image' && '🖼️'}
                      {asset.type === 'video' && '🎥'}
                      {asset.type === 'document' && '📄'}
                    </div>
                    <span className="font-bold text-white block truncate">{asset.name}</span>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-semibold uppercase tracking-wider">
                      <span>{asset.size}</span>
                      <span>{asset.date}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#2D2D30]/40">
                    <button className="flex-1 px-2.5 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 font-bold uppercase tracking-wider text-[9px]">Edit</button>
                    <button className="px-2.5 py-1.5 rounded bg-red-950/20 text-red-400 hover:bg-red-950/40 border border-red-900/30 font-bold uppercase tracking-wider text-[9px]">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
