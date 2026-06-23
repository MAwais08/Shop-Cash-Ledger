import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import { useAppStore } from '../store/appStore'
import Cash from './Cash'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: true, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ authed: true })
  await useAppStore.getState().addTransaction({
    type: 'send', walletId: 'jazzcash', walletDelta: -5000_00, amount: 5000_00,
    commission: 50_00, discount: 0, notesIn: { 5000: 2 }, notesOut: {},
  })
})

function renderPage() {
  return render(<MemoryRouter><Cash /></MemoryRouter>)
}

describe('Cash', () => {
  it('shows the total cash after a transaction', () => {
    renderPage()
    const totalCard = screen.getByText('Total Cash').closest('section') as HTMLElement
    expect(totalCard).toHaveTextContent('Rs 10,000')
  })

  it('shows the count for the 5000 denomination', () => {
    renderPage()
    const row = screen.getByText('Rs 5000').closest('li') as HTMLElement
    expect(row).toHaveTextContent('2')
  })
})
