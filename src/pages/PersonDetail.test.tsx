import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { InMemoryRepository } from '../data/inMemoryRepository'
import { seedData } from '../data/seed'
import PersonDetail from './PersonDetail'

let personId = ''

beforeEach(async () => {
  useAppStore.setState({ data: null, authed: false, repo: null })
  await useAppStore.getState().init(new InMemoryRepository(seedData()))
  useAppStore.setState({ data: { ...useAppStore.getState().data!, drawer: { 1000: 5 } } })
  personId = await useAppStore.getState().addPerson('Ali')
})

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/udhari/${id}`]}>
      <Routes>
        <Route path="/udhari/:personId" element={<PersonDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PersonDetail page', () => {
  it('renders the person name in the page header', () => {
    renderAt(personId)
    expect(screen.getByRole('heading', { name: /Ali/i })).toBeInTheDocument()
  })

  it('records a cash udhar given and reduces the drawer', async () => {
    renderAt(personId)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '2000' } })
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByLabelText('add Rs 1000'))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(useAppStore.getState().data!.udharEntries).toHaveLength(1)
    })
    expect(useAppStore.getState().data!.drawer[1000]).toBe(3)
  })
})
