import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Dashboard from './Dashboard'

beforeEach(async () => {
  const data = seedData()
  data.drawer = { 5000: 2, 100: 5 } // 10,500
  data.wallets = [{ id: 'easypaisa', name: 'Easypaisa', balance: 19510_00 }]
  useAppStore.setState({ data: null, authed: true, repo: null })
  const repo = new InMemoryRepository(data)
  await useAppStore.getState().init(repo)
  useAppStore.setState({ authed: true })
})

function renderDash() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('shows total cash and the big/small split', () => {
    renderDash()
    expect(screen.getByText('Rs 10,500')).toBeInTheDocument() // total
    expect(screen.getByText('Rs 10,000')).toBeInTheDocument() // big
    expect(screen.getByText('Rs 500')).toBeInTheDocument() // small
  })

  it('lists each wallet balance', () => {
    renderDash()
    expect(screen.getByText('Easypaisa')).toBeInTheDocument()
    expect(screen.getByText('Rs 19,510')).toBeInTheDocument()
  })

  it('shows today summary from real transactions', async () => {
    await useAppStore.getState().addTransaction({
      type: 'send', walletId: 'easypaisa', walletDelta: -1000_00, amount: 1000_00,
      commission: 30_00, discount: 0, notesIn: { 1000: 1 }, notesOut: {},
    })
    renderDash()
    expect(screen.getByText('Rs 30')).toBeInTheDocument() // today profit
  })
})
