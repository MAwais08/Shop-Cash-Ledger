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
      type: 'deposit', walletId: 'easypaisa', walletDelta: -1000_00, amount: 1000_00,
      commission: 30_00, commissionMode: 'cash', notesIn: { 1000: 1, 20: 1, 10: 1 }, notesOut: {},
    })
    renderDash()
    expect(screen.getByText('Rs 30')).toBeInTheDocument() // today profit
  })

  it('shows Total Worth + today kharcha and links to kharcha + udhari', async () => {
    const base = useAppStore.getState().data!
    useAppStore.setState({
      data: {
        ...base,
        drawer: { 100: 10 },
        expenses: [{ id: 'e1', category: 'Bijli', amount: 200_00, payment: 'cash', walletId: null, createdAt: new Date().toISOString() }],
        persons: [{ id: 'p1', name: 'Ali' }],
        udharEntries: [{ id: 'u1', personId: 'p1', type: 'given', amount: 500_00, payment: 'cash', walletId: null, createdAt: new Date().toISOString() }],
      },
    })
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Worth')).toBeInTheDocument()
    expect(screen.getByText('Rs 200')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add expense/i })).toHaveAttribute('href', '/kharcha')
    expect(screen.getByRole('link', { name: /credit ledger/i })).toHaveAttribute('href', '/udhari')
  })
})
