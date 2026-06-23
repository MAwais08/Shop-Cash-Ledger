import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import Udhari from './Udhari'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
})

describe('Udhari list page', () => {
  it('adds a person and lists them', async () => {
    render(<MemoryRouter><Udhari /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ali' } })
    fireEvent.click(screen.getByRole('button', { name: /add person/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.persons).toHaveLength(1)
    })
    expect(screen.getByText('Ali')).toBeInTheDocument()
  })

  it('shows a balance indicator for each person in the list', async () => {
    await useAppStore.getState().addPerson('Ali', undefined)
    render(<MemoryRouter><Udhari /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
    })
    // Balance starts at zero — formatPKR(0) renders "Rs 0"
    const balanceEls = screen.getAllByText(/Rs\s*0/i)
    expect(balanceEls.length).toBeGreaterThan(0)
  })
})
