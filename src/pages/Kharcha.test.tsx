import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import Kharcha from './Kharcha'

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 100: 10 } } })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <Kharcha />
    </MemoryRouter>,
  )
}

describe('Kharcha page', () => {
  it('adds a cash expense and reduces the drawer', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '300' } })
    fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByRole('button', { name: /save kharcha/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.expenses).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[100]).toBe(7)
  })

  it('shows an error when cash paid exceeds the drawer', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '5000' } })
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('add Rs 100'))
    fireEvent.click(screen.getByRole('button', { name: /save kharcha/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(useAppStore.getState().data!.expenses).toHaveLength(0)
  })
})
