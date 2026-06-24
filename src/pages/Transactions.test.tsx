import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Transactions from './Transactions'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: true, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ authed: true })
  await useAppStore.getState().addTransaction({
    type: 'deposit', walletId: 'jazzcash', amount: 5000_00,
    commission: 50_00, commissionMode: 'cash', notesIn: { 5000: 1, 50: 1 }, notesOut: {}, customerName: 'Ali Khan',
  })
  await useAppStore.getState().addTransaction({
    type: 'deposit', walletId: 'easypaisa', amount: 2000_00,
    commission: 20_00, commissionMode: 'cash', notesIn: { 2000: 1, 20: 1 }, notesOut: {}, customerName: 'Bilal',
  })
})

function renderPage() {
  return render(<MemoryRouter><Transactions /></MemoryRouter>)
}

describe('Transactions', () => {
  it('lists transactions with customer names', () => {
    renderPage()
    expect(screen.getByText('Ali Khan')).toBeInTheDocument()
    expect(screen.getByText('Bilal')).toBeInTheDocument()
  })

  it('filters by search query', async () => {
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'ali')
    expect(screen.getByText('Ali Khan')).toBeInTheDocument()
    expect(screen.queryByText('Bilal')).not.toBeInTheDocument()
  })

  it('deletes a transaction', async () => {
    renderPage()
    const before = useAppStore.getState().data!.transactions.length
    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    expect(useAppStore.getState().data!.transactions.length).toBe(before - 1)
  })
})
