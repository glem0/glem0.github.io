"""Dive Bondi — Rezdy monthly calendar widget embedded on divebondi.com.au."""
from common import Event, Window
from sources.rezdy import fetch_rezdy

ID = "divebondi"
NAME = "Dive Bondi"
SHORT = "Dive Bondi"
URL = "https://www.divebondi.com.au/dive-calendar"


def fetch(window: Window) -> list[Event]:
    return fetch_rezdy(ID, "https://divebondi.rezdy.com", 597076, window)
