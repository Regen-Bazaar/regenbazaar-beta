'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { LogOut, Menu, X, User } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import toast from 'react-hot-toast'

const Navbar = () => {
  const { walletAddress, connect, disconnect, isConnecting } = useWallet()
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleConnectWallet = async (
    walletType: string,
    manualAddress?: string
  ) => {
    try {
      await connect(walletType, manualAddress)
      setIsWalletModalOpen(false)
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to connect wallet')
      } else {
        toast.error('An unexpected error occurred')
      }
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast.success('Wallet disconnected successfully')
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to disconnect wallet')
      } else {
        toast.error('An unexpected error occurred')
      }
    }
  }

  return (
    <nav className='sticky top-0 z-50 border-b border-gray-700 bg-[#111111]'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 items-center justify-between'>
          <div className='flex items-center'>
            <Link href='/' className='text-2xl font-bold text-green-400'>
              Regen Bazaar
            </Link>
            <div className='hidden md:block'>
              <div className='ml-10 flex items-baseline space-x-4'>
                <Link
                  href='/about'
                  className='rounded-md bg-green-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-600'
                >
                  About
                </Link>
                <Link
                  href='/projects'
                  className='rounded-md bg-green-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-600'
                >
                  Projects
                </Link>
                <Link
                  href='/organizations'
                  className='rounded-md bg-green-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-600'
                >
                  Organizations
                </Link>
                <Link
                  href='/leaderboard'
                  className='rounded-md bg-green-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-600'
                >
                  Leaderboard
                </Link>
                <Link
                  href='/stake'
                  className='rounded-md bg-green-500 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-600'
                >
                  Stake
                </Link>
              </div>
            </div>
          </div>
          <div className='hidden md:block'>
            <div className='ml-4 flex items-center space-x-4 md:ml-6'>
              <Link
                href='/create-project'
                className='rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-black hover:bg-green-600'
              >
                Create Project
              </Link>
              {walletAddress ? (
                <div className='flex items-center space-x-4'>
                  <span className='text-sm font-medium text-gray-300'>{`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}</span>
                  <button
                    onClick={handleDisconnect}
                    className='flex items-center space-x-1 text-gray-300 hover:text-green-400'
                  >
                    <LogOut className='h-4 w-4' />
                    <span className='text-sm'>Disconnect</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  disabled={isConnecting}
                  className='rounded bg-green-500 px-4 py-2 text-sm text-black transition-colors hover:bg-green-600 disabled:opacity-50'
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
          <div className='flex items-center md:hidden'>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className='inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:ring-2 focus:ring-white focus:outline-none focus:ring-inset'
            >
              {isMenuOpen ? (
                <X className='h-6 w-6' />
              ) : (
                <Menu className='h-6 w-6' />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className='border-t border-gray-700 bg-[#111111] md:hidden'>
          <div className='space-y-1 px-2 pt-2 pb-3 sm:px-3'>
            <Link
              href='/about'
              className='block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
            >
              About
            </Link>
            <Link
              href='/projects'
              className='block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
            >
              Projects
            </Link>
            <Link
              href='/organizations'
              className='block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
            >
              Organizations
            </Link>
            <Link
              href='/leaderboard'
              className='block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
            >
              Leaderboard
            </Link>
            <Link
              href='/stake'
              className='block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
            >
              Stake
            </Link>
            <Link
              href='/create-project'
              className='block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
            >
              Create Project
            </Link>
            {!walletAddress && (
              <button
                onClick={() => {
                  setIsWalletModalOpen(true)
                  setIsMenuOpen(false)
                }}
                disabled={isConnecting}
                className='block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-green-400'
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
          {walletAddress && (
            <div className='border-t border-gray-700 pt-4 pb-3'>
              <div className='flex items-center px-5'>
                <User className='h-8 w-8 text-gray-400' />
                <div className='ml-3'>
                  <div className='text-base leading-none font-medium text-white'>{`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}</div>
                </div>
              </div>
              <div className='mt-3 space-y-1 px-2'>
                <button
                  onClick={() => {
                    handleDisconnect()
                    setIsMenuOpen(false)
                  }}
                  className='block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white'
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onSelectWallet={handleConnectWallet}
      />
    </nav>
  )
}

export default Navbar
