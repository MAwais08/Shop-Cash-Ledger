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
})
